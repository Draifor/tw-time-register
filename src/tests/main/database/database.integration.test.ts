import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

/**
 * Integration test for the DatabaseWrapper against a real SQLite database.
 *
 * The wrapper runs in the Electron main process and its driver
 * (`better-sqlite3`) is compiled for Electron's Node ABI, so Vitest's plain
 * Node runtime cannot load it. The assertions therefore execute in a child
 * process started with Electron's Node (`ELECTRON_RUN_AS_NODE=1`), which loads
 * the real TypeScript sources, the real `database/schema.sql` and the real
 * `better-sqlite3`. See `src/tests/fixtures/db-integration-harness.cjs`.
 */

const nodeRequire = createRequire(import.meta.url);
const REPO_ROOT = process.cwd();
const HARNESS_PATH = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'db-integration-harness.cjs');
const RESULT_MARKER = '__DB_RESULT__';

const EXPECTED_INDEXES = [
  'idx_te_date',
  'idx_te_date_start',
  'idx_te_date_end',
  'idx_te_task',
  'idx_te_send',
  'idx_te_task_times',
  'idx_sh_entry',
  'idx_sh_tw_entry',
  'idx_sh_entry_ok',
  'idx_tasks_type',
  'idx_tasks_name',
  'idx_typetasks_name'
];

interface HarnessResult {
  foreignKeys: number;
  journalMode: string;
  synchronous: number;
  busyTimeout: number;
  entriesBeforeDelete: number;
  entriesAfterDelete: number;
  statementsBefore: number;
  statementsAfter: number;
  txThrew: boolean;
  txCommitted: number;
  txRolledBack: number;
  indexNames: string[];
  dateRangePlan: string[];
  joinPlan: string[];
  syncHistoryPlan: string[];
  tasksLookupPlan: string[];
}

function runHarness(dbDir: string): HarnessResult {
  const electronExecutable = nodeRequire('electron') as string;
  const stdout = execFileSync(electronExecutable, [HARNESS_PATH], {
    cwd: REPO_ROOT,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', TW_DB_DIR: dbDir },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000
  });
  const markerIndex = stdout.lastIndexOf(RESULT_MARKER);
  if (markerIndex === -1) {
    throw new Error(`Database harness produced no result marker. Output:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(markerIndex + RESULT_MARKER.length).trim()) as HarnessResult;
}

let dbDir: string;
let result: HarnessResult;

describe('DatabaseWrapper — real SQLite contract', () => {
  beforeAll(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-time-register-db-'));
    result = runHarness(dbDir);
  }, 60_000);

  afterAll(() => {
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('enables the SQLite pragmas required for correctness and durability', () => {
    expect(result.foreignKeys).toBe(1);
    expect(result.journalMode).toBe('wal');
    expect(result.synchronous).toBe(1);
    expect(result.busyTimeout).toBe(5000);
  });

  it('cascades a task deletion to its time_entries', () => {
    expect(result.entriesBeforeDelete).toBe(1);
    expect(result.entriesAfterDelete).toBe(0);
  });

  it('creates every expected index', () => {
    for (const indexName of EXPECTED_INDEXES) {
      expect(result.indexNames).toContain(indexName);
    }
  });

  it('resolves the time_entries date filter through an index', () => {
    const plan = result.dateRangePlan.join(' ');
    expect(plan).toContain('USING INDEX');
    expect(plan).toMatch(/idx_te_date/);
    expect(plan).not.toContain('SCAN time_entries');
  });

  it('resolves the time_entries/tasks join through an index without scanning time_entries', () => {
    const plan = result.joinPlan.join(' ');
    expect(plan).toContain('USING INDEX');
    expect(plan).not.toContain('SCAN time_entries');
  });

  it('resolves the last-successful-sync lookup through an index', () => {
    expect(result.syncHistoryPlan.join(' ')).toContain('idx_sh_entry_ok');
  });

  it('resolves the tasks name/type lookup through an index', () => {
    expect(result.tasksLookupPlan.join(' ')).toContain('idx_tasks_name');
  });

  it('reuses a prepared statement when the same SQL runs twice', () => {
    expect(result.statementsAfter).toBe(result.statementsBefore + 1);
  });

  it('commits and rolls back transactions', () => {
    expect(result.txThrew).toBe(true);
    expect(result.txCommitted).toBe(1);
    expect(result.txRolledBack).toBe(0);
  });
});
