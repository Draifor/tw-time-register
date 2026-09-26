/*
 * Real-SQLite integration harness for the DatabaseWrapper.
 *
 * Why this exists as a child process:
 *  - `database.ts` imports `electron`, so the real wrapper can only be loaded
 *    once `electron` resolves. We stub it here.
 *  - The project's `better-sqlite3` is built for Electron's Node ABI, so plain
 *    Node (which runs Vitest) cannot load it. This harness is executed by
 *    Electron in `ELECTRON_RUN_AS_NODE` mode, where the native module loads.
 *  - It loads the real TypeScript sources (`database.ts`, `migrations.ts`) and
 *    the real `database/schema.sql`; nothing about the SQLite contract is
 *    reimplemented or mocked.
 *
 * It prints a single `__DB_RESULT__<json>` line that the Vitest test asserts on.
 * Requires TW_DB_DIR (a writable temp directory) in the environment.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname, process, Buffer */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TYPESCRIPT = require(path.join(REPO_ROOT, 'node_modules', 'typescript'));

// Transpile the TypeScript sources on require (type stripping only).
require.extensions['.ts'] = function compileTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const output = TYPESCRIPT.transpileModule(source, {
    compilerOptions: {
      module: TYPESCRIPT.ModuleKind.CommonJS,
      target: TYPESCRIPT.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: TYPESCRIPT.JsxEmit.Preserve
    },
    fileName: filename
  }).outputText;
  module._compile(output, filename);
};

// Stub `electron`: under ELECTRON_RUN_AS_NODE the module resolves to a path string.
const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        getPath: () => process.env.TW_DB_DIR,
        getAppPath: () => REPO_ROOT,
        isPackaged: false
      },
      safeStorage: {
        isEncryptionAvailable: () => false,
        encryptString: (value) => Buffer.from(String(value)),
        decryptString: (buffer) => Buffer.from(buffer).toString('utf8')
      }
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const planDetails = (rows) => rows.map((row) => row.detail);

async function main() {
  const databaseModule = require(path.join(REPO_ROOT, 'src', 'main', 'database', 'database.ts'));
  const migrationsModule = require(path.join(REPO_ROOT, 'src', 'main', 'database', 'migrations.ts'));

  const openDb = databaseModule.default;
  const db = await openDb();
  await migrationsModule.runMigrations();

  const foreignKeys = (await db.get('PRAGMA foreign_keys')).foreign_keys;
  const journalMode = (await db.get('PRAGMA journal_mode')).journal_mode;
  const synchronous = (await db.get('PRAGMA synchronous')).synchronous;
  const busyTimeout = (await db.get('PRAGMA busy_timeout')).timeout;

  // Cascade contract: deleting a task removes its time entries.
  const typeId = (await db.run('INSERT INTO type_tasks (type_name) VALUES (?)', ['Integration'])).lastID;
  const taskId = (await db.run('INSERT INTO tasks (type_id, task_name) VALUES (?, ?)', [typeId, 'CascadeTask'])).lastID;
  await db.run('INSERT INTO time_entries (task_id, entry_date, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)', [
    taskId,
    '2026-01-01',
    '09:00',
    '10:00'
  ]);
  const entriesBeforeDelete = (await db.get('SELECT COUNT(*) AS c FROM time_entries')).c;
  await db.run('DELETE FROM tasks WHERE task_id = ?', [taskId]);
  const entriesAfterDelete = (await db.get('SELECT COUNT(*) AS c FROM time_entries')).c;

  // Statement cache: the same SQL twice must reuse one prepared statement.
  const statementsBefore = db.preparedStatementCount();
  await db.get('SELECT 1 AS one');
  await db.get('SELECT 1 AS one');
  const statementsAfter = db.preparedStatementCount();

  // Transaction primitive: commit persists, throw rolls back.
  db.transaction(() => {
    void db.run('INSERT INTO type_tasks (type_name) VALUES (?)', ['TxCommitted']);
  });
  const txCommitted = (await db.get('SELECT COUNT(*) AS c FROM type_tasks WHERE type_name = ?', ['TxCommitted'])).c;

  let txThrew = false;
  try {
    db.transaction(() => {
      void db.run('INSERT INTO type_tasks (type_name) VALUES (?)', ['TxRolledBack']);
      throw new Error('rollback-probe');
    });
  } catch (error) {
    txThrew = error.message === 'rollback-probe';
  }
  const txRolledBack = (await db.get('SELECT COUNT(*) AS c FROM type_tasks WHERE type_name = ?', ['TxRolledBack'])).c;

  const indexNames = (await db.all("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name")).map(
    (row) => row.name
  );
  const dateRangePlan = planDetails(
    await db.all('EXPLAIN QUERY PLAN SELECT * FROM time_entries WHERE entry_date = ?', ['2026-01-01'])
  );
  const joinPlan = planDetails(
    await db.all(
      'EXPLAIN QUERY PLAN SELECT te.entry_id FROM time_entries te LEFT JOIN tasks t ON te.task_id = t.task_id WHERE te.entry_date = ?',
      ['2026-01-01']
    )
  );
  const syncHistoryPlan = planDetails(
    await db.all(
      'EXPLAIN QUERY PLAN SELECT * FROM sync_history WHERE entry_id = ? AND success = 1 ORDER BY synced_at DESC',
      [1]
    )
  );
  const tasksLookupPlan = planDetails(
    await db.all('EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE task_name = ? AND type_id = ?', ['CascadeTask', 1])
  );

  process.stdout.write(
    '__DB_RESULT__' +
      JSON.stringify({
        foreignKeys,
        journalMode,
        synchronous,
        busyTimeout,
        entriesBeforeDelete,
        entriesAfterDelete,
        statementsBefore,
        statementsAfter,
        txThrew,
        txCommitted,
        txRolledBack,
        indexNames,
        dateRangePlan,
        joinPlan,
        syncHistoryPlan,
        tasksLookupPlan
      }) +
      '\n'
  );

  await databaseModule.closeDb();
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write('DB_HARNESS_ERROR: ' + (error && error.stack ? error.stack : String(error)) + '\n');
  process.exit(1);
});
