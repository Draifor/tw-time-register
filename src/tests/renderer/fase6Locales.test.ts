/**
 * Contract cover for the UX-602 locale cleanup (Fase 6, slice 3).
 *
 * `en`/`es` must stay mirrored, the Spanish copy must be genuinely translated
 * (no English leftovers), and the keys proven unused after T1/T2 must stay
 * removed. i18next renders a missing key as its own name, so a leftover or a
 * deleted-but-still-referenced key would ship broken UI with the rest of the
 * suite green.
 */
import { describe, it, expect } from 'vitest';
import en from '../../renderer/locales/en';
import es from '../../renderer/locales/es';

type Tree = Record<string, unknown>;

function leafKeys(tree: Tree, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      out.push(...leafKeys(value as Tree, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

function get(tree: Tree, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => (acc as Tree | undefined)?.[segment], tree);
}

const enTree = en.translations as Tree;
const esTree = es.translations as Tree;
const enLeaves = leafKeys(enTree);
const esLeaves = leafKeys(esTree);

describe('Fase 6 locale parity (UX-602)', () => {
  it('en and es expose identical leaf-key sets', () => {
    expect([...esLeaves].sort()).toEqual([...enLeaves].sort());
  });
});

// Every entry must be real translated Spanish copy that differs from English.
const CORRECTED_ES_COPY: Record<string, string> = {
  // Step 1 — explicitly listed English leftovers.
  'timeLogs.pull.subtitle':
    'Descarga tus registros de tiempo de TeamWork al historial local. Solo se importan entradas nuevas.',
  'settings.holidays.syncButton': 'Sincronizar festivos',
  'tasks.form.taskLinkLabel': 'Enlace TW (opcional)',
  'tasks.importTW.fieldLink': 'Enlace',
  'tasks.importCSV.colLink': 'Enlace',
  'tasks.importCSV.dialogDescription':
    'Importa tareas en lote desde un archivo CSV con las columnas Tarea, Tipo y Enlace.',
  'tasks.importCSV.colTaskName': 'Nombre de tarea',
  // Additional English leftovers found by the UX-602 rescan.
  'tasks.editLink': 'Editar enlace',
  'tasks.importTW.duplicateLinksWarning':
    'Se detectaron {{count}} enlaces duplicados en tu BD. Se usará la primera coincidencia.',
  'home.timerRunning': 'Temporizador en curso',
  'workTimeForm.timer.start': 'Iniciar temporizador',
  'workTimeForm.timer.stop': 'Detener temporizador',
  'workTimeForm.timer.otherRunning': 'Hay otro temporizador activo',
  'settings.teamwork.username': 'Usuario / Correo'
};

describe('Fase 6 corrected Spanish copy (UX-602)', () => {
  it.each(Object.entries(CORRECTED_ES_COPY))('%s resolves to corrected Spanish copy', (key, expected) => {
    // The Spanish value is the expected translation and must differ from English.
    expect(get(enTree, key)).not.toBe(expected);
    expect(get(esTree, key)).toBe(expected);
  });
});

// Keys proven unreferenced by any `t()` call in `src/renderer` after T1/T2.
const REMOVED_ORPHAN_KEYS = [
  'common.selectLanguage',
  'common.export',
  'common.noData',
  'table.addRow',
  'table.addFirstEntry',
  'timeLogs.deleteError',
  'timeLogs.noTaskLink',
  'timeLogs.noTWTaskId',
  'timeLogs.durationZero',
  'timeLogs.noTWUserId',
  'tasks.importTW.importFailed',
  'tasks.importTW.diagnosticTitle',
  'tasks.importTW.diagnosticHint',
  'tasks.importTW.noSubtasks',
  'tasks.importTW.importedCount',
  'tasks.importTW.notFoundDesc',
  'tasks.importTW.importSuccessCount',
  'taskComment.notifyLoading'
];

describe('Fase 6 orphan locale keys removed (UX-602)', () => {
  it.each(REMOVED_ORPHAN_KEYS)('%s is absent from both locales', (key) => {
    expect(get(enTree, key)).toBeUndefined();
    expect(get(esTree, key)).toBeUndefined();
  });
});
