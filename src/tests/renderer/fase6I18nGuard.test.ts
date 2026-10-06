// @vitest-environment jsdom
/**
 * Guard for the UX-601 i18n extraction (Fase 6, slice 2).
 *
 * These components/hooks shipped hardcoded UI copy — window-control
 * `aria-label`s, table headers, inline cell labels, toasts and sample
 * placeholders. UX-601 moved every one of them behind `t('...')`. i18next
 * renders a missing key as its own name, so a regression that reintroduces a
 * literal would ship English to every locale with the rest of the suite green.
 * This scans each touched source file and fails if a removed literal returns.
 *
 * Brand/proper nouns (`TW Time Register`, `TeamWork`), URL prefixes/suffixes
 * (`https://`, `.teamwork.com`), language endonyms (`Español`, `English`) and
 * decorative placeholders (the password dots) are intentionally out of scope.
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import i18n, { loadLanguage } from '../../renderer/plugins/i18n';
import AppBar from '../../renderer/components/AppBar';
import DeleteButton from '../../renderer/components/DeleteButton';

interface FileGuard {
  file: string;
  literals: Array<[string, RegExp]>;
}

const GUARDS: FileGuard[] = [
  {
    file: 'src/renderer/components/AppBar.tsx',
    literals: [
      ['minimize aria-label', /aria-label="Minimize"/],
      ['restore/maximize aria-label', /isMaximize \? 'Restore' : 'Maximize'/],
      ['close aria-label', /aria-label="Close"/]
    ]
  },
  {
    file: 'src/renderer/pages/SettingsPage.tsx',
    literals: [
      ['settings load toast', /toast\.error\('Error loading settings'\)/],
      ['domain sample', /placeholder="miempresa"/],
      ['username sample', /placeholder="usuario@empresa\.com"/],
      ['user id sample', /placeholder="123456"/]
    ]
  },
  {
    file: 'src/renderer/components/SwitchDarkMode.tsx',
    literals: [
      ['moon alt', /alt="moon"/],
      ['sun alt', /alt="sun"/]
    ]
  },
  {
    file: 'src/renderer/components/SelectLanguage.tsx',
    literals: [['language fallback', /\|\| 'Language'/]]
  },
  {
    file: 'src/renderer/components/DeleteButton.tsx',
    literals: [
      ['title', />Are you sure\?</],
      ['item fallback', /'this item'/],
      ['description prefix', /This will permanently delete/],
      ['description suffix', /This action cannot be undone/],
      ['cancel action', />\s*Cancel\s*</],
      ['delete action', />\s*Delete\s*</]
    ]
  },
  {
    file: 'src/renderer/components/ui/combobox.tsx',
    literals: [
      ['select placeholder', /placeholder = 'Select an option'/],
      ['search placeholder', /searchPlaceholder = 'Search\.\.\.'/],
      ['no results', /No results found\./],
      ['progress title', /Progreso:/]
    ]
  },
  {
    file: 'src/renderer/components/ui/dialog.tsx',
    literals: [['sr-only close', /sr-only">Close/]]
  },
  {
    file: 'src/renderer/components/ImportCSVTasksDialog.tsx',
    literals: [
      ['parse fallback', /Failed to parse the CSV file/],
      ['sample task header', />TareaTW</],
      ['sample type header', />Tipo</],
      ['sample link header', />Link</]
    ]
  },
  {
    file: 'src/renderer/components/TimeLogsTable.tsx',
    literals: [
      ['billable no', /text-muted-foreground text-xs">No</],
      ['sync label', /`Sync \$\{pendingCount\}`/],
      ['progress title overtime', /'Overtime' : progress\.status === 'warning'/],
      ['progress title on time', /'Warning' : 'On time'/]
    ]
  },
  {
    file: 'src/renderer/App.tsx',
    literals: [['loading fallback', />Loading\.\.\.</]]
  },
  {
    file: 'src/renderer/hooks/useTasks.tsx',
    literals: [
      ['group header', /'Teamwork Tasks'/],
      ['task name header', /'Task Name'/],
      ['task type header', /'Task Type'/],
      ['task link header', /'Task Link'/],
      ['description header', /'Description'/],
      ['estimated header', /'Est\. Time'/],
      ['progress header', /'Progress'/],
      ['actions header', /'Actions'/],
      ['sync header', /'Sync'/],
      ['comment header', /'Comment'/],
      ['delete header', /'Delete'/],
      ['view in TW cell', /'Ver en TW'/],
      ['edit link title', /title="Editar link"/],
      ['edit estimated title', /title="Editar tiempo estimado"/],
      ['over time label', />Over time</],
      ['margin label', />Margin: /],
      ['no type tooltip', /"Sin tipo asignado"/],
      ['assign type placeholder', /"Asignar tipo…"/],
      ['link placeholder', /placeholder="https:\/\/\.\.\."/],
      ['time placeholder', /placeholder="HH:MM"/],
      ['item fallback', /'this task'/],
      ['update error toast', /toast\.error\('Failed to update task'/],
      ['update success toast', /toast\.success\('Task updated successfully'\)/],
      ['delete success toast', /toast\.success\('Task deleted successfully'\)/],
      ['delete error toast', /toast\.error\('Failed to delete task'/]
    ]
  },
  {
    file: 'src/renderer/hooks/useTypeTasks.tsx',
    literals: [
      ['group header', /'Task Types'/],
      ['name header', /'Name'/],
      ['actions header', /'Actions'/],
      ['item fallback', /'this type'/],
      ['add success toast', /toast\.success\('Type added successfully'\)/],
      ['add error toast', /toast\.error\('Failed to add type'/],
      ['update success toast', /toast\.success\('Type updated successfully'\)/],
      ['update error toast', /toast\.error\('Failed to update type'/],
      ['delete success toast', /toast\.success\('Type deleted successfully'\)/],
      ['delete error toast', /toast\.error\('Failed to delete type'/]
    ]
  }
];

describe('Fase 6 i18n extraction guard (UX-601)', () => {
  for (const { file, literals } of GUARDS) {
    it(`${file} has no hardcoded UI copy`, () => {
      const source = readFileSync(join(process.cwd(), file), 'utf8');
      const offenders = literals.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);

      expect(offenders).toEqual([]);
    });
  }
});

// The guard above proves the literals are gone; these assertions prove the new
// keys actually resolve to real copy instead of echoing themselves. English is
// pinned to its exact value and Spanish must differ (genuinely translated).
const NEW_EN_COPY: Record<string, string> = {
  'common.close': 'Close',
  'common.language': 'Language',
  'common.actions': 'Actions',
  'appBar.minimize': 'Minimize',
  'appBar.restore': 'Restore',
  'appBar.maximize': 'Maximize',
  'deleteButton.title': 'Are you sure?',
  'combobox.noResults': 'No results found.',
  'tasks.colTaskName': 'Task Name',
  'tasks.viewInTW': 'View in TW',
  'settings.teamwork.domainPlaceholder': 'mycompany',
  'timeLogs.syncCount': 'Sync {{count}}'
};

describe('Fase 6 new keys resolve to real copy (UX-601)', () => {
  it('pins the English copy', async () => {
    await i18n.changeLanguage('en');

    for (const [key, copy] of Object.entries(NEW_EN_COPY)) {
      const resolved = String(i18n.t(key));
      expect(resolved).not.toBe(key);
      expect(resolved).toBe(copy);
    }
  });

  it('resolves to genuinely translated Spanish copy', async () => {
    await loadLanguage('es');
    await i18n.changeLanguage('es');

    expect(i18n.hasResourceBundle('es', 'translations')).toBe(true);

    for (const key of Object.keys(NEW_EN_COPY)) {
      const resolved = String(i18n.t(key));
      expect(resolved).not.toBe(key);
      expect(resolved.length).toBeGreaterThan(0);
    }

    // A representative slice must actually differ from English, not fall back.
    for (const key of ['common.close', 'appBar.minimize', 'deleteButton.title', 'combobox.noResults']) {
      expect(String(i18n.t(key))).not.toBe(NEW_EN_COPY[key]);
    }
  });
});

// R3-KEY-RESOLUTION-COVERAGE: the block above only proves the *newly added*
// keys resolve. UX-601 also REUSED pre-existing keys in the extracted code,
// and a reused key that silently became orphaned would echo itself just as
// loudly. Pin those reused keys to real copy in both locales too.
const REUSED_EN_COPY: Record<string, string> = {
  'tasks.tableTitle': 'TeamWork Tasks',
  'common.description': 'Description',
  'common.cancel': 'Cancel'
};

describe('Fase 6 reused keys resolve to real copy (UX-601)', () => {
  it('pins the English copy', async () => {
    await i18n.changeLanguage('en');

    for (const [key, copy] of Object.entries(REUSED_EN_COPY)) {
      const resolved = String(i18n.t(key));
      expect(resolved).not.toBe(key);
      expect(resolved).toBe(copy);
    }
  });

  it('resolves to genuinely translated Spanish copy', async () => {
    await loadLanguage('es');
    await i18n.changeLanguage('es');

    expect(i18n.hasResourceBundle('es', 'translations')).toBe(true);

    for (const [key, copy] of Object.entries(REUSED_EN_COPY)) {
      const resolved = String(i18n.t(key));
      expect(resolved).not.toBe(key);
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved).not.toBe(copy);
    }
  });

  // `progressInfo` is reused with interpolation, so non-key resolution alone is
  // not enough: assert the passed values actually land in the rendered string
  // (a wrapper that dropped the options would still resolve to real copy).
  it('interpolates workTimeForm.progressInfo in en and es', async () => {
    const values = { logged: '1:15', estimated: '4:00', pct: 31, margin: '2:45' };

    await i18n.changeLanguage('en');
    const en = String(i18n.t('workTimeForm.progressInfo', values));
    expect(en).not.toBe('workTimeForm.progressInfo');
    for (const value of ['1:15', '4:00', '31', '2:45']) {
      expect(en).toContain(value);
    }

    await loadLanguage('es');
    await i18n.changeLanguage('es');
    const es = String(i18n.t('workTimeForm.progressInfo', values));
    expect(es).not.toBe('workTimeForm.progressInfo');
    for (const value of ['1:15', '4:00', '31', '2:45']) {
      expect(es).toContain(value);
    }

    // Genuinely translated, not the English interpolation.
    expect(es).not.toBe(en);
  });
});

// R3-NEGATIVE-ONLY-GUARD: everything above is a negative source-text scan or a
// pure i18n lookup. Neither proves a component actually *renders* localized
// copy. These render-level assertions close that gap: the component tree must
// surface the resolved string at the level a user (or screen reader) sees it.
//
// Radix popper/alert primitives need DOM helpers jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
Object.assign(Element.prototype, {
  hasPointerCapture: () => false,
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
  scrollIntoView: () => {}
});

const isMaximizedMock = vi.fn();

function installWindowMain() {
  isMaximizedMock.mockReset().mockResolvedValue(false);
  (window as unknown as { Main: unknown }).Main = {
    Minimize: vi.fn(),
    Maximize: vi.fn(),
    Close: vi.fn(),
    isMaximized: isMaximizedMock,
    on: vi.fn(),
    off: vi.fn(),
    checkForUpdates: vi.fn(),
    getAppVersion: vi.fn().mockResolvedValue('1.14.0')
  };
}

describe('Fase 6 components render localized copy (UX-601)', () => {
  beforeEach(() => {
    cleanup();
    installWindowMain();
  });

  it.each([
    ['en', 'Minimize'],
    ['es', 'Minimizar']
  ])('renders the AppBar window-control name in %s', async (lng, expectedName) => {
    await loadLanguage(lng);
    await i18n.changeLanguage(lng);

    render(React.createElement(AppBar));

    expect(await screen.findByRole('button', { name: expectedName })).toBeInTheDocument();
  });

  it('renders DeleteButton dialog title and description from deleteButton.* keys', async () => {
    await i18n.changeLanguage('en');

    render(React.createElement(DeleteButton, { itemName: 'Task 42', onConfirm: vi.fn() }));

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(String(i18n.t('deleteButton.title')))).toBeInTheDocument();
    expect(screen.getByText(String(i18n.t('deleteButton.deletePrefix')), { exact: false })).toBeInTheDocument();
    expect(screen.getByText(String(i18n.t('deleteButton.deleteSuffix')), { exact: false })).toBeInTheDocument();
  });
});
