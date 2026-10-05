# ODD — UX Fase 6: i18n and copy cleanup

- **Feature:** UX Fase 6 of [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) (UX-601..UX-604)
- **Branch:** `feat/ux-fase-6-i18n-cleanup` (base: `origin/staging` @ `94e03ab`, v1.14.0 release outcome)
- **Started:** 2026-10-05
- **Route:** delegated direct (one writer per work unit); parent owns tracking docs and review orchestration
- **Delivery strategy:** `feature-branch-chain` (user-approved 2026-10-05). Tracker branch
  `feat/ux-fase-6-i18n-cleanup`; child PRs target the tracker. Planned slices:
  (1) UX-603 dead code, (2) UX-601 hardcoded strings, (3) UX-602 locales, (4) UX-604 action copy,
  (5) closure. Line counts confirmed at PR time.
- **RDD:** on (global). Assessment + native review apply per work unit; reviewed boundary advances on
  acknowledgement.
- **Runner:** `pnpm test` (Vitest). Checks: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

## Objective

Zero untranslated UI text and zero dead UI residue: every user-facing string is resolved through i18n,
`en`/`es` stay mirrored and correct, orphan components/props/locale keys are gone, and one action maps to
one verb across the whole app.

## Problem (current-tree evidence — roadmap refs are from v1.13.0 and are stale)

A read-only map (2026-10-05) on the current tree found:

- **UX-601 — the debt is WIDER than the roadmap lists.** `DataTable.tsx` is already i18n'd (roadmap refs
  stale). Real hardcoded UI strings remain in:
  - `AppBar.tsx:62,63,83,90,97,108,112` — brand text/alt plus window control `aria-label`s
    (`Minimize`/`Restore`/`Maximize`/`Close`).
  - `SettingsPage.tsx:166` untranslated `toast.error('Error loading settings')`; sample/placeholder copy
    at `:407,419,430,444,453,462,476,493`.
  - `SwitchDarkMode.tsx:17,20` `alt="moon"/"sun"`.
  - `SelectLanguage.tsx:63` fallback `'Language'`.
  - `useTasks.tsx` — all catalog column headers (`:309,315,321,353,360,366,373,382,385,388,397`) and cell
    copy (`:68,79,139,176,178,327,337,400`) plus toasts (`:219,224,254,259,270,273`) hardcoded in English.
  - `useTypeTasks.tsx:25,27,34,36,43,45` toasts hardcoded.
  - `DeleteButton.tsx:39,45` (`Are you sure?`/`Cancel`); `ui/combobox.tsx:249` (`No results found.`);
    `ui/dialog.tsx:47` sr-only `Close`; `ImportCSVTasksDialog.tsx:148-152`; `TimeLogsTable.tsx:202`;
    `App.tsx:43` (`Loading...`); `Filter.tsx:15,22,31` (component is dead — see UX-603).
- **UX-602 — parity already achieved, content cleanup remains.** `en.ts`/`es.ts` have identical key sets
  (~469 leaf keys each). `menu.view.*` (devtools/zoom) and `menu.help.versionLabel` were already removed in
  Fase 1 (guarded by `i18nMenuKeys.test.ts`), so those roadmap items are done. Remaining: untranslated
  English inside `es.ts` (`:106` `time entries`, `:285` `Sync festivos`, `:349` `Link TW (opcional)`,
  `:404` `Link`, `:423`), the `tasks.importCSV.colTaskName` divergence (`Task Name` vs `TareaTW`), and an
  orphan-key scan against source usage.
- **UX-603 — dead code confirmed.**
  - `SettingsPage.tsx:64-72` `DAYS_OF_WEEK`: `label` is used (`:568` builds `maxHours${day.label}`);
    **`labelEs` is never referenced** → dead.
  - `TypeTasksTable.tsx:138` `onPersist={(row) => row}` no-op still present.
  - `onAddRow`: accepted/used inside `DataTable.tsx`/`useTable.tsx` but **no caller passes it**;
    `useTasks.tsx:413-420` `handleAddRow` returned at `:436` is never destructured; `useTasks` also returns
    `onSubmit`, `isLoadingMutation`, `onDelete` unconsumed by its real caller.
  - `DynamicForm.tsx` ↔ `FormField.tsx` are an orphan pair (only `DynamicForm` imports `FormField`;
    nothing imports `DynamicForm`); `FormFieldProps` (`types/dataTable.ts:35`) exists only for them.
  - `Filter.tsx` has **no importer anywhere** → dead component.
- **UX-604 — glossary exists, application is inconsistent.** UI-003 glossary is documented in
  `odd/tasks/ux-fase-0-ia.md:37-53` (primary submit `Save`/`Guardar`; add row `Add entry`/`Agregar
  entrada`; brand only in AppBar + About). Current drift: `New` vs `Add` for the same create action
  (`tasks.form.addTaskBtn`/`typeForm.addTypeBtn` vs `submitBtn`), `Add Row`/`Add First Entry` vs
  `Add entry`, `Create an entry` vs `Add Entry` vs `addEntry`, `Save` vs `Save to local database` vs
  `Save Settings`. Hardcoded toasts in `useTasks`/`useTypeTasks` duplicate existing keys but bypass `t()`.

## Scope

**In:** move all remaining user-facing UI strings to `en.ts`/`es.ts`; fix untranslated/divergent `es` copy
and remove orphan keys; delete confirmed dead UI code and props; align action verbs across buttons, toasts
and errors to the UX-003 glossary; add/adjust focused tests; tick the roadmap and record evidence.

**Out (other phases / initiatives):** Reports backlog (Fase 7), WorkTimeForm calculation logic, E2E visual
tests, brand redesign. Brand/proper nouns (`TW Time Register`) stay as-is in the titlebar/About per the
UX-003 rule; the Electron window title is brand, not translatable copy.

## Tasks

- [x] **T1 · UX-603 — Remove dead UI code** (slice 1) — ✅ 2026-10-05, commit `e3c4242`
  - Deleted orphan `DynamicForm.tsx` + `FormField.tsx` + `Filter.tsx`; removed `FormFieldProps` (and the
    transitively-orphaned `NewRecord` + dead `DataTableProps`) from `types/dataTable.ts`; removed
    `DAYS_OF_WEEK.labelEs`; removed the `TypeTasksTable` `onPersist` no-op; removed the dead `onAddRow`
    path (prop + both render branches + phantom `SkeletonTable` add button) and the dead `useTasks`
    `onSubmit` add-mutation return plus `onDelete`/`isLoadingMutation` returns; deleted the dead-path
    optimistic-add test (kept the edit test).
  - `pnpm type-check` clean; `pnpm lint` 0 errors / 83 warnings (baseline); `pnpm test` 71 files / 492
    tests green; `pnpm build` green. Assess: risk `medium`, `review_due_reason = under_budget` (349 lines,
    11 paths) → no native review due.
  - Acceptance: no orphan components, no dead props/fields; suite + type-check green. ✅

- [ ] **T2 · UX-601 — Move hardcoded UI strings to locales** (slice 2)
  - Every UI-visible literal from the map moves behind `t()` with new `en`/`es` keys (AppBar window
    controls, SettingsPage toast/samples, SwitchDarkMode alts, SelectLanguage fallback, `useTasks`/
    `useTypeTasks` headers + cell copy + toasts, DeleteButton, combobox, dialog sr-only Close,
    ImportCSVTasksDialog, TimeLogsTable, App loading).
  - Acceptance: no UI literals outside locales except brand/proper nouns; EN/ES both resolve every string.

- [ ] **T3 · UX-602 — Fix and complete locales** (slice 3)
  - Translate the English leftovers in `es.ts`; resolve the `importCSV.colTaskName` divergence; remove
    locale keys with no source usage (after T1/T2 settle the surface).
  - Acceptance: `en`/`es` mirrored, correct, no orphan keys.

- [ ] **T4 · UX-604 — Unify action copy per the UX-003 glossary** (slice 4)
  - Apply one verb per action across buttons/toasts/errors (`Add`, `Save`, `Delete`, `Edit`…), removing
    the `New`/`Add`/`Create` and `Add Row`/`Add First Entry` drift.
  - Acceptance: one verb per action app-wide; no synonym drift.

- [ ] **T5 · Closure — verification + roadmap** (slice 5)
  - Full checks green; `docs/UX-ROADMAP.md` Fase 6 items ticked with date/PR; this doc's outcome recorded.

## Authorized files

- `src/renderer/components/DynamicForm.tsx` (delete)
- `src/renderer/components/FormField.tsx` (delete)
- `src/renderer/components/Filter.tsx` (delete)
- `src/types/dataTable.ts`
- `src/renderer/components/DataTable.tsx`
- `src/renderer/components/TasksTable.tsx`
- `src/renderer/components/TypeTasksTable.tsx`
- `src/renderer/components/AppBar.tsx`
- `src/renderer/components/DeleteButton.tsx`
- `src/renderer/components/SwitchDarkMode.tsx`
- `src/renderer/components/SelectLanguage.tsx`
- `src/renderer/components/ImportCSVTasksDialog.tsx`
- `src/renderer/components/TimeLogsTable.tsx`
- `src/renderer/components/ui/combobox.tsx`
- `src/renderer/components/ui/dialog.tsx`
- `src/renderer/pages/SettingsPage.tsx`
- `src/renderer/App.tsx`
- `src/renderer/hooks/useTasks.tsx`
- `src/renderer/hooks/useTypeTasks.tsx`
- `src/renderer/hooks/useTable.tsx`
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `docs/UX-ROADMAP.md`
- `src/tests/renderer/**` (new/updated tests)

## Checks

```pwsh
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Task-specific: no orphan imports after T1 (grep `DynamicForm|FormField|Filter` → only intended refs);
no UI literals outside locales after T2 (grep sweep); EN/ES resolve every key + no orphan keys after T3;
one verb per action after T4.

## Delivery

- Strategy: `feature-branch-chain` (user-approved 2026-10-05). Tracker branch
  `feat/ux-fase-6-i18n-cleanup`; child slices off the tracker, one cohesive unit each; child PRs target the
  tracker. Slicing confirmed at PR time with one honest pass.
- Forecast: ~400–650 authored changed lines (locale keys dominate) across 4 tasks.

| Slice | Task | Branch | Commit(s) | Lines |
| --- | --- | --- | --- | --- |
| 1 | UX-603 dead code | `feat/ux-fase-6-01-dead-code` | `e3c4242` | 349 |
| 2 | UX-601 hardcoded strings | `feat/ux-fase-6-02-i18n-strings` | — | — |
| 3 | UX-602 locales | `feat/ux-fase-6-03-locales` | — | — |
| 4 | UX-604 action copy | `feat/ux-fase-6-04-action-copy` | — | — |

## Progress log

- 2026-10-05 — User authorized Fase 6 ("vamos con la fase 6"). Tracker branch
  `feat/ux-fase-6-i18n-cleanup` created from `origin/staging` (`94e03ab`). Read-only map done (roadmap refs
  stale; debt wider than listed; en/es parity already met; orphans confirmed). Task doc created. Delivery
  strategy: `feature-branch-chain` (user-approved). Planned slices recorded.
- 2026-10-05 — Slice 1 (UX-603) done: deleted orphan `DynamicForm`/`FormField`/`Filter` + `FormFieldProps`,
  `NewRecord`, dead `DataTableProps`; removed `labelEs`, `onPersist` no-op, `onAddRow` path, and the dead
  `useTasks` `onSubmit`/`onDelete`/`isLoadingMutation` returns; removed the dead-path add test. Commit
  `e3c4242` (`feat/ux-fase-6-01-dead-code`), +20/−329 across 11 files. Type-check/lint/test/build green.
  Assess risk `medium`, `under_budget` → no review due. Chained topology: child #1 targets the tracker;
  later children target the immediate parent branch (slices stacked).
