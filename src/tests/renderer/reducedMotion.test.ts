/**
 * Reduced-motion guard (UX-506).
 *
 * The app animates `animate-ping` / `animate-pulse` / `animate-spin`; users who
 * request reduced motion must not receive that movement. This is a static guard
 * on `index.css`, resolved from this file's location (not `process.cwd()`), so
 * it keeps working regardless of the runner's working directory, mirroring the
 * `contrastTokens` / `rawPaletteGuard` pattern.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CSS = readFileSync(new URL('../../renderer/index.css', import.meta.url), 'utf8');

describe('reduced motion guard (UX-506)', () => {
  it('declares a prefers-reduced-motion: reduce block', () => {
    expect(CSS).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('neutralizes animation and transition durations inside that block', () => {
    const start = CSS.search(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(start).toBeGreaterThanOrEqual(0);

    const block = CSS.slice(start);
    expect(block).toMatch(/animation-duration/);
    expect(block).toMatch(/animation-iteration-count/);
    expect(block).toMatch(/transition-duration/);
  });
});
