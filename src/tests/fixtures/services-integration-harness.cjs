/*
 * Real-SQLite integration harness for the P1 service optimizations.
 *
 * Runs under Electron in ELECTRON_RUN_AS_NODE mode (plain Node cannot load the
 * project's better-sqlite3 build). It loads the real TypeScript services and the
 * real schema, seeds deterministic data and reports:
 *  - getTasks per-task totals for the aggregation edge cases, plus a direct
 *    comparison between the new integer arithmetic and the previous julianday
 *    expression;
 *  - addTimeEntries rollback and batch behaviour;
 *  - getAllTimeEntries / getSyncHistory default vs. bounded reads.
 *
 * It prints a single `__SERVICES_RESULT__<json>` line the Vitest test asserts on.
 * Requires TW_DB_DIR (a writable temp directory) in the environment.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname, process, Buffer */
const fs = require('fs');
const path = require('path');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const TYPESCRIPT = require(path.join(REPO_ROOT, 'node_modules', 'typescript'));

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

const INTEGER_MINUTES = `(CAST(substr(hora_fin, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_fin, 4, 2) AS INTEGER)) -
      (CAST(substr(hora_inicio, 1, 2) AS INTEGER) * 60 + CAST(substr(hora_inicio, 4, 2) AS INTEGER))`;

async function main() {
  const databaseModule = require(path.join(REPO_ROOT, 'src', 'main', 'database', 'database.ts'));
  const migrationsModule = require(path.join(REPO_ROOT, 'src', 'main', 'database', 'migrations.ts'));
  const taskService = require(path.join(REPO_ROOT, 'src', 'main', 'services', 'taskService.ts'));
  const timeEntriesService = require(path.join(REPO_ROOT, 'src', 'main', 'services', 'timeEntriesService.ts'));

  const openDb = databaseModule.default;
  const db = await openDb();
  await migrationsModule.runMigrations();

  const typeId = (await db.run('INSERT INTO type_tasks (type_name) VALUES (?)', ['AggType'])).lastID;
  const createTask = async (name) =>
    (
      await db.run('INSERT INTO tasks (type_id, task_name, task_link, description) VALUES (?, ?, ?, ?)', [
        typeId,
        name,
        '',
        ''
      ])
    ).lastID;
  const addEntry = (taskId, date, start, end) =>
    db.run('INSERT INTO time_entries (task_id, entry_date, hora_inicio, hora_fin) VALUES (?, ?, ?, ?)', [
      taskId,
      date,
      start,
      end
    ]);

  const noEntries = await createTask('NoEntries');
  const oneEntry = await createTask('OneEntry');
  const severalEntries = await createTask('SeveralEntries');
  const crossingBoundary = await createTask('CrossingBoundary');
  const searchTarget = await createTask('SearchTarget');

  await addEntry(oneEntry, '2026-01-01', '09:00', '10:30'); // 90
  await addEntry(severalEntries, '2026-01-01', '09:00', '10:00'); // 60
  await addEntry(severalEntries, '2026-01-02', '11:00', '12:30'); // 90 → 150
  await addEntry(crossingBoundary, '2026-01-01', '09:45', '11:15'); // 90, crosses an hour boundary
  await addEntry(searchTarget, '2026-01-01', '10:00', '10:30'); // 30

  const tasks = await taskService.getTasks();
  const totalsById = new Map(tasks.map((task) => [task.id, task.totalLoggedMinutes]));

  const searchResults = await taskService.getTasks('SearchTarget');

  const integerRows = await db.all(
    `SELECT task_id, COALESCE(SUM(${INTEGER_MINUTES}), 0) AS minutes FROM time_entries GROUP BY task_id`
  );
  const floatRows = await db.all(
    `SELECT task_id, ROUND(COALESCE(SUM((julianday(hora_fin) - julianday(hora_inicio)) * 24 * 60), 0)) AS minutes
     FROM time_entries GROUP BY task_id`
  );
  const floatById = new Map(floatRows.map((row) => [row.task_id, row.minutes]));
  const integerEqualsFloat = integerRows.every((row) => floatById.get(row.task_id) === row.minutes);

  // P1-04b: a failing entry in the middle of a batch must roll the whole batch back.
  const countEntries = async () => (await db.get('SELECT COUNT(*) AS c FROM time_entries')).c;

  const entriesBeforeRollback = await countEntries();
  let addTimeEntriesThrew = false;
  try {
    await timeEntriesService.addTimeEntries([
      { taskId: oneEntry, description: 'ok', date: '2026-02-01', startTime: '09:00', endTime: '10:00' },
      { taskId: 999999, description: 'bad FK', date: '2026-02-01', startTime: '10:00', endTime: '11:00' }
    ]);
  } catch {
    addTimeEntriesThrew = true;
  }
  const entriesAfterRollback = await countEntries();

  const batchIds = await timeEntriesService.addTimeEntries([
    { taskId: oneEntry, description: 'b1', date: '2026-02-02', startTime: '09:00', endTime: '10:00' },
    { taskId: oneEntry, description: 'b2', date: '2026-02-02', startTime: '10:00', endTime: '11:00' },
    { taskId: oneEntry, description: 'b3', date: '2026-02-02', startTime: '11:00', endTime: '12:00' }
  ]);
  const entriesAfterBatch = await countEntries();

  // P1-07: default reads stay unbounded; bounded reads honour limit/offset.
  const allEntries = await timeEntriesService.getAllTimeEntries();
  const pagedEntries = await timeEntriesService.getAllTimeEntries({ limit: 2, offset: 1 });

  await db.run(
    "INSERT INTO sync_history (entry_id, action, success) VALUES (?, 'created', 1), (?, 'updated', 1), (?, 'deleted', 1)",
    [oneEntry, oneEntry, oneEntry]
  );
  const historyService = require(path.join(REPO_ROOT, 'src', 'main', 'services', 'historyService.ts'));
  const syncHistoryUnbounded = await historyService.getSyncHistory(oneEntry);
  const syncHistoryPage = await historyService.getSyncHistory(oneEntry, { limit: 1, offset: 1 });

  // P1-06: count every DB read issued by one getNextAvailableSlot call. The
  // result must not grow with the number of scanned days.
  const originalAll = db.all.bind(db);
  const originalGet = db.get.bind(db);
  let queryCount = 0;
  db.all = async (...args) => {
    queryCount++;
    return originalAll(...args);
  };
  db.get = async (...args) => {
    queryCount++;
    return originalGet(...args);
  };
  const slot = await timeEntriesService.getNextAvailableSlot();
  db.all = originalAll;
  db.get = originalGet;

  process.stdout.write(
    '__SERVICES_RESULT__' +
      JSON.stringify({
        totals: {
          noEntries: totalsById.get(noEntries),
          oneEntry: totalsById.get(oneEntry),
          severalEntries: totalsById.get(severalEntries),
          crossingBoundary: totalsById.get(crossingBoundary)
        },
        searchResultCount: searchResults.length,
        searchTaskNames: searchResults.map((task) => task.taskName),
        searchTotal: searchResults[0] ? searchResults[0].totalLoggedMinutes : null,
        integerEqualsFloat,
        addTimeEntriesThrew,
        rollbackCountUnchanged: entriesBeforeRollback === entriesAfterRollback,
        batchInserted: entriesAfterBatch - entriesAfterRollback,
        batchIdCount: batchIds.length,
        allEntriesCount: allEntries.length,
        pagedEntriesCount: pagedEntries.length,
        syncHistoryUnbounded: syncHistoryUnbounded.length,
        syncHistoryPage: syncHistoryPage.length,
        slotQueryCount: queryCount,
        slotDate: slot.date,
        slotStartTime: slot.startTime
      }) +
      '\n'
  );

  await databaseModule.closeDb();
  process.exit(0);
}

main().catch((error) => {
  process.stderr.write('SERVICES_HARNESS_ERROR: ' + (error && error.stack ? error.stack : String(error)) + '\n');
  process.exit(1);
});
