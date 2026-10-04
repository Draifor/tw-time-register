/**
 * R3-002 follow-up guard for Fase 1. Removing the renderer File/Edit/View menu
 * also removed its i18n keys (`menu.file.*`, `menu.edit.*`, `menu.view.*`,
 * `menu.help.documentation`, `menu.help.versionLabel`). i18next renders a
 * missing key as its own name, so a leftover `t('menu.view.zoomIn')` would ship
 * as literal UI text with every gate green. This scans the renderer source and
 * fails if any of the removed keys is referenced again.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REMOVED_KEY = /t\(\s*(['"`])(menu\.(?:file|edit|view)\.|menu\.help\.(?:documentation|versionLabel))/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (
      /\.(ts|tsx)$/.test(full) &&
      !/\.test\.(ts|tsx)$/.test(full) &&
      !full.replace(/\\/g, '/').includes('/locales/')
    ) {
      out.push(full);
    }
  }
  return out;
}

describe('removed renderer menu i18n keys (R3-002)', () => {
  it('are not referenced by any renderer t() call', () => {
    const root = join(process.cwd(), 'src', 'renderer');
    const offenders = walk(root).filter((file) => REMOVED_KEY.test(readFileSync(file, 'utf8')));

    expect(offenders).toEqual([]);
  });
});
