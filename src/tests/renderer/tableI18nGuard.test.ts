/**
 * Guard for the T4 i18n extraction (UX-204).
 *
 * `DataTable` shipped hardcoded English copy (`Search...`, `Add Row`,
 * `No data yet`, ...). T4 moved all of it behind `t('table.*')`. i18next
 * renders a missing key as its own name, so a regression that reintroduces a
 * literal would ship English to every locale with the rest of the suite green.
 * This scans the four table components and fails if any removed literal returns.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TABLE_COMPONENTS = ['DataTable.tsx', 'TimeLogsTable.tsx', 'TasksTable.tsx', 'TypeTasksTable.tsx'];

const REMOVED_LITERALS: Array<[string, RegExp]> = [
  ['empty title', /No data yet/],
  ['empty description', /Get started by adding your first entry/],
  ['empty action', /Add First Entry/],
  ['error title', /Something went wrong/],
  ['default error message', /An unexpected error occurred/],
  ['search placeholder', /Search\.\.\./],
  ['add row', /Add Row/],
  ['clear search', /Clear search/],
  ['no results', /No results found for/],
  ['scroll hint', /Scroll for more/]
];

describe('table components use i18n copy (UX-204)', () => {
  for (const file of TABLE_COMPONENTS) {
    it(`${file} has no hardcoded table copy`, () => {
      const source = readFileSync(join(process.cwd(), 'src', 'renderer', 'components', file), 'utf8');
      const offenders = REMOVED_LITERALS.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);

      expect(offenders).toEqual([]);
    });
  }
});
