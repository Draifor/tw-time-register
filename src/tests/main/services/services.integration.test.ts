import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

/**
 * Integration tests for the P1 service optimizations against a real SQLite
 * database. The project's better-sqlite3 build targets Electron's Node ABI and
 * cannot load under Vitest's plain Node runtime, so the assertions execute in an
 * Electron child process that loads the real TypeScript services and schema.
 * See `src/tests/fixtures/services-integration-harness.cjs`.
 */

const nodeRequire = createRequire(import.meta.url);
const REPO_ROOT = process.cwd();
const HARNESS_PATH = path.join(REPO_ROOT, 'src', 'tests', 'fixtures', 'services-integration-harness.cjs');
const RESULT_MARKER = '__SERVICES_RESULT__';

interface ServicesResult {
  totals: {
    noEntries: number;
    oneEntry: number;
    severalEntries: number;
    crossingBoundary: number;
  };
  searchResultCount: number;
  searchTaskNames: string[];
  searchTotal: number | null;
  integerEqualsFloat: boolean;
  addTimeEntriesThrew: boolean;
  rollbackCountUnchanged: boolean;
  batchInserted: number;
  batchIdCount: number;
  allEntriesCount: number;
  pagedEntriesCount: number;
  syncHistoryUnbounded: number;
  syncHistoryPage: number;
  slotQueryCount: number;
  slotDate: string;
  slotStartTime: string;
}

function runHarness(dbDir: string): ServicesResult {
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
    throw new Error(`Services harness produced no result marker. Output:\n${stdout}`);
  }
  return JSON.parse(stdout.slice(markerIndex + RESULT_MARKER.length).trim()) as ServicesResult;
}

let dbDir: string;
let result: ServicesResult;

describe('Service optimizations — real SQLite contract', () => {
  beforeAll(() => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-time-register-services-'));
    result = runHarness(dbDir);
  }, 60_000);

  afterAll(() => {
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  describe('getTasks aggregation (P1-05)', () => {
    it('returns 0 minutes for a task with no entries', () => {
      expect(result.totals.noEntries).toBe(0);
    });

    it('sums a single entry', () => {
      expect(result.totals.oneEntry).toBe(90);
    });

    it('sums several entries of the same task', () => {
      expect(result.totals.severalEntries).toBe(150);
    });

    it('sums an entry that crosses an hour boundary', () => {
      expect(result.totals.crossingBoundary).toBe(90);
    });

    it('produces the same totals as the previous julianday expression', () => {
      expect(result.integerEqualsFloat).toBe(true);
    });

    it('keeps the LIKE search behaviour', () => {
      expect(result.searchResultCount).toBe(1);
      expect(result.searchTaskNames).toEqual(['SearchTarget']);
      expect(result.searchTotal).toBe(30);
    });
  });

  describe('batch writes (P1-04b)', () => {
    it('rolls back the whole batch when one insert fails', () => {
      expect(result.addTimeEntriesThrew).toBe(true);
      expect(result.rollbackCountUnchanged).toBe(true);
    });

    it('commits a successful batch and returns every new id', () => {
      expect(result.batchInserted).toBe(3);
      expect(result.batchIdCount).toBe(3);
    });
  });

  describe('getNextAvailableSlot query count (P1-06)', () => {
    it('issues a constant number of DB reads per call', () => {
      // settings + holidays + last-entry lookup + one range aggregate.
      expect(result.slotQueryCount).toBe(4);
    });

    it('still returns the expected slot shape', () => {
      expect(result.slotDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.slotStartTime).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe('bounded reads (P1-07)', () => {
    it('keeps getAllTimeEntries unbounded by default', () => {
      expect(result.allEntriesCount).toBeGreaterThanOrEqual(4);
    });

    it('honours limit/offset on getAllTimeEntries', () => {
      expect(result.pagedEntriesCount).toBe(2);
    });

    it('keeps getSyncHistory unbounded by default and pageable', () => {
      expect(result.syncHistoryUnbounded).toBe(3);
      expect(result.syncHistoryPage).toBe(1);
    });
  });
});
