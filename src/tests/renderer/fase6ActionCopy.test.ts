/**
 * Contract cover for the UX-604 action-copy unification (Fase 6, slice 4).
 *
 * The UX-003 glossary (odd/tasks/ux-fase-0-ia.md) prescribes one verb per
 * action: primary submit = `Save` / `Guardar`, add row / add entry = `Add entry`
 * / `Agregar entrada`. Before this slice the copy mixed `New`/`Add`/`Create`
 * for creation and `Save`/`Save Settings`/`Save to local database` for saving.
 * i18next renders a missing key as its own name, so a regression that drifts
 * one label back would ship inconsistent UI with the rest of the suite green.
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

// Canonical glossary copy for every drifted action label/toast key.
const ACTION_COPY: Record<string, { en: string; es: string }> = {
  'tasks.form.addTaskBtn': { en: 'Add task', es: 'Agregar tarea' },
  'tasks.typeForm.addTypeBtn': { en: 'Add type', es: 'Agregar tipo' },
  'workTimeForm.addEntry': { en: 'Add entry', es: 'Agregar entrada' },
  'workTimeForm.addEntryTooltip': { en: 'Add entry', es: 'Agregar entrada' },
  'settings.saveSettings': { en: 'Save', es: 'Guardar' },
  'workTimeForm.register': { en: 'Save', es: 'Guardar' },
  'timeLogs.createEntry': {
    en: 'Add an entry on the home screen',
    es: 'Agrega una entrada en la pantalla principal'
  },
  'timeLogs.saveChanges': { en: 'Save', es: 'Guardar' }
};

describe('Fase 6 action copy (UX-604)', () => {
  it.each(Object.entries(ACTION_COPY))('%s pins the canonical EN/ES copy', (key, { en: enCopy, es: esCopy }) => {
    expect(get(enTree, key)).toBe(enCopy);
    expect(get(esTree, key)).toBe(esCopy);
  });

  it('en and es expose identical leaf-key sets', () => {
    expect([...leafKeys(esTree)].sort()).toEqual([...leafKeys(enTree)].sort());
  });

  // The toolbar opener and the submit must share the same verb after the change.
  it('aligns each creation opener with its submit label', () => {
    expect(get(enTree, 'tasks.form.addTaskBtn')).toBe(get(enTree, 'tasks.form.submitBtn'));
    expect(get(esTree, 'tasks.form.addTaskBtn')).toBe(get(esTree, 'tasks.form.submitBtn'));
    expect(get(enTree, 'tasks.typeForm.addTypeBtn')).toBe(get(enTree, 'tasks.typeForm.submitBtn'));
    expect(get(esTree, 'tasks.typeForm.addTypeBtn')).toBe(get(esTree, 'tasks.typeForm.submitBtn'));
  });

  // Guard against `New ...`/`Create ...`/`Save ...` synonym drift returning to
  // the action labels this slice owns.
  it.each(Object.keys(ACTION_COPY))('%s carries no creation/save synonym drift', (key) => {
    const enCopy = String(get(enTree, key));
    const esCopy = String(get(esTree, key));
    expect(enCopy).not.toMatch(/(^|\s)(New|Create)\s/);
    expect(enCopy).not.toMatch(/^Save\s/);
    expect(esCopy).not.toMatch(/(^|\s)(Nuev[oa]|Crear|Crea)\s/);
    expect(esCopy).not.toMatch(/^Guardar\s/);
  });
});
