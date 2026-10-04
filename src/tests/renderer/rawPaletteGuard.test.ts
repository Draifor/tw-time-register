/**
 * Raw palette guard (T2 acceptance criterion).
 *
 * The design-system migration moved UI colors onto semantic tokens, so a raw
 * hex color literal must not appear anywhere in renderer source. If one does,
 * it bypasses the tokens and fails to adapt to dark mode. This guard scans
 * `src/renderer` for `.ts`/`.tsx` files and fails if any contains a raw hex
 * color literal.
 *
 * The scan directory is resolved from this file's location (not
 * `process.cwd()`) so it keeps working regardless of the runner's working
 * directory. `.css`, `.svg`, and test files are excluded: `index.css` is the
 * single place where the palette is defined, and tests may assert on literals.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RENDERER_DIR = fileURLToPath(new URL('../../renderer', import.meta.url));
const HEX_COLOR = /#[0-9a-fA-F]{3,8}\b/;

describe('raw palette guard', () => {
  it('contains no raw hex color literals in renderer source', () => {
    const entries = readdirSync(RENDERER_DIR, { recursive: true, withFileTypes: true });

    const offenders = entries
      .filter((entry) => entry.isFile())
      .filter((entry) => entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))
      .filter((entry) => !entry.name.includes('.test.'))
      .filter((entry) => {
        const fullPath = path.join(entry.parentPath, entry.name);
        const source = readFileSync(fullPath, 'utf8');
        return HEX_COLOR.test(source);
      })
      .map((entry) => path.relative(RENDERER_DIR, path.join(entry.parentPath, entry.name)));

    expect(
      offenders,
      `Raw hex color literals are not allowed in renderer source (use semantic tokens). Offending files:\n${offenders
        .map((file) => `  - ${file}`)
        .join('\n')}`
    ).toEqual([]);
  });
});
