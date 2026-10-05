/**
 * Keyboard focus visibility guard (UX-506).
 *
 * The inline-edit inputs in `useTasks` and `useTypeTasks` used
 * `focus:outline-hidden` with no replacement ring, so keyboard users could not
 * see where focus landed. This static guard pins a visible `focus-visible` ring
 * on both files so a future refactor cannot silently drop it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const FILES = ['../../renderer/hooks/useTasks.tsx', '../../renderer/hooks/useTypeTasks.tsx'];

describe('keyboard focus visibility (UX-506)', () => {
  for (const file of FILES) {
    it(`${file} keeps a visible focus-visible ring`, () => {
      const source = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(source).toMatch(/focus-visible:ring-2/);
    });
  }
});
