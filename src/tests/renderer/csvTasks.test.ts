/**
 * Unit cover for PERF-606: the pure CSV helpers must keep the exact parsing
 * semantics the dialog used inline, and the chunked async variant must produce
 * output identical to the synchronous one while yielding between chunks.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseCSV, isHeaderRow, parseTasksCsv, parseTasksCsvChunked } from '../../renderer/lib/csvTasks';

describe('csvTasks', () => {
  describe('parseCSV', () => {
    it('handles quoted fields containing commas and escaped quotes', () => {
      expect(parseCSV('"a,b",c\n"he said ""hi""",d')).toEqual([
        ['a,b', 'c'],
        ['he said "hi"', 'd']
      ]);
    });

    it('trims fields and skips blank lines', () => {
      expect(parseCSV(' a , b \n\n c , d ')).toEqual([
        ['a', 'b'],
        ['c', 'd']
      ]);
    });
  });

  describe('isHeaderRow', () => {
    it('detects known header labels case-insensitively', () => {
      expect(isHeaderRow(['Task', 'Type', 'Link'])).toBe(true);
      expect(isHeaderRow(['tarea', 'tipo', 'link'])).toBe(true);
      expect(isHeaderRow(['foo', 'bar'])).toBe(false);
    });
  });

  describe('parseTasksCsv', () => {
    it('returns an empty-file error for blank input', () => {
      expect(parseTasksCsv('')).toEqual({
        rows: [],
        malformed: [],
        error: 'The file appears to be empty.'
      });
    });

    it('skips a header row and parses the data rows', () => {
      const result = parseTasksCsv('Task,Type,Link\nalpha,Bug,http://x');
      expect(result.error).toBeNull();
      expect(result.rows).toEqual([{ taskName: 'alpha', typeName: 'Bug', taskLink: 'http://x' }]);
      expect(result.malformed).toEqual([]);
    });

    it('reports the header-only case', () => {
      expect(parseTasksCsv('Task,Type,Link\n').error).toBe('No data rows found after skipping the header.');
    });

    it('flags rows with fewer than two columns but keeps the valid ones', () => {
      const result = parseTasksCsv('Task,Type,Link\nalpha,Bug\nlonely');
      expect(result.rows).toEqual([{ taskName: 'alpha', typeName: 'Bug', taskLink: '' }]);
      expect(result.malformed).toEqual([2]);
      expect(result.error).toBe('1 row(s) have fewer than 2 columns and will be skipped (rows: 2).');
    });

    it('returns the no-valid-rows error when every row is malformed', () => {
      expect(parseTasksCsv('lonely\nalso-lonely').error).toBe('No valid rows to import.');
    });
  });

  describe('parseTasksCsvChunked', () => {
    function makeCsv(rowCount: number): string {
      const lines = ['Task,Type,Link'];
      for (let i = 0; i < rowCount; i++) {
        lines.push(`task-${i},Bug,http://example.com/${i}`);
      }
      return lines.join('\n');
    }

    it('matches parseTasksCsv for a valid file', async () => {
      const text = makeCsv(25);
      const sync = parseTasksCsv(text);
      const chunked = await parseTasksCsvChunked(text, { chunkSize: 4 });
      expect(chunked).toEqual(sync);
    });

    it('matches parseTasksCsv for malformed, header-only, and empty inputs', async () => {
      const cases = ['', 'Task,Type,Link\n', 'Task,Type\nlonely', 'lonely\nalso-lonely'];
      for (const text of cases) {
        await expect(parseTasksCsvChunked(text, { chunkSize: 2 })).resolves.toEqual(parseTasksCsv(text));
      }
    });

    it('yields between chunks instead of parsing everything synchronously', async () => {
      const text = makeCsv(50);
      const yieldToEventLoop = vi.fn(() => Promise.resolve());
      const result = await parseTasksCsvChunked(text, { chunkSize: 5, yieldToEventLoop });

      expect(result).toEqual(parseTasksCsv(text));
      expect(yieldToEventLoop.mock.calls.length).toBeGreaterThan(1);
    });
  });
});
