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

- [x] **T2 · UX-601 — Move hardcoded UI strings to locales** (slice 2) — ✅ 2026-10-05, commit `13df113`
  - Every mapped UI literal moved behind `t()` with mirrored `en`/`es` keys: AppBar window controls;
    SettingsPage load toast + TW sample placeholders; `SwitchDarkMode` decorative alts; `SelectLanguage`
    fallback; `useTasks`/`useTypeTasks` column headers + cell copy + toasts; `DeleteButton`; `combobox`;
    `dialog` sr-only close; `ImportCSVTasksDialog`; `TimeLogsTable`; App loading. Brand/proper nouns and
    format tokens kept. RED→GREEN source-scan guard `fase6I18nGuard.test.ts` (14 tests).
  - `pnpm type-check` clean; `pnpm lint` 0 errors / 83 warnings (baseline, after suppressing a new
    exhaustive-deps warning on the mount-time settings load); `pnpm test` 72 files / 506 tests green;
    `pnpm build` green. Assess: risk `medium`, review_due `slice_budget_reached` (523 lines, 15 paths).
  - Native review lineage `review-e5bb65c401131367`, lens `review-reliability`: **approved**; authority
    burned via exact acknowledgement. 4 non-blocking advisories recorded (see Review section).
  - Acceptance: no UI literals outside locales except brand/proper nouns; EN/ES both resolve every string. ✅

- [x] **T3 · UX-602 — Fix and complete locales** (slice 3) — ✅ 2026-10-05, commit `4bcc96a`
  - Translated 14 Spanish values that were still English (pull subtitle, holidays sync, task/type link
    labels, timer labels, TW username, etc.); resolved the `importCSV.colTaskName` divergence
    (`TareaTW` → `Nombre de tarea`, matching EN `Task Name`); removed 18 orphan keys from both bundles.
    New `fase6Locales.test.ts` (33 tests, RED→GREEN) pins parity + corrected copy + orphan absence.
  - `pnpm type-check`/`lint` (0 errors/83 warnings)/`test` (73 files / 539 tests)/`build` all green.
    Assess: risk `medium`, `review_due_reason = under_budget` (166 lines) → no review due.
  - Acceptance: `en`/`es` mirrored (493 keys each), correct, no orphan keys. ✅

- [x] **T4 · UX-604 — Unify action copy per the UX-003 glossary** (slice 4) — ✅ 2026-10-05, commit `81700ca`
  - Applied `Add`/`Agregar` for creation and `Save`/`Guardar` for primary submit across 8 action keys
    (task/type add buttons + submits, work-time add-entry + submit, Settings submit, inline save, and the
    home-screen add-entry copy). New `fase6ActionCopy.test.ts` (18 tests, RED→GREEN) pins the contract and
    guards against synonym drift. Dialog/section titles (e.g. `New template`) kept as names, not verbs.
  - Assess: risk `medium`, `review_due_reason = under_budget` (124 lines) → no review due.
  - Acceptance: one verb per action app-wide; no synonym drift. ✅

- [x] **T5 · Closure — verification + roadmap** (slice 5) — ✅ 2026-10-05, commit `d622340`
  - Closed both queued slice-2 advisories: added reused-key resolution assertions (`workTimeForm.progressInfo`
    with interpolation, `tasks.tableTitle`, `common.description`, `common.cancel`) and render-level
    localization proofs (`AppBar` window-control name; `DeleteButton` dialog copy) to `fase6I18nGuard.test.ts`.
    Ticked `docs/UX-ROADMAP.md` UX-601..604 and updated `Estado general` to Fases 0–6.
  - Final chain checks: `pnpm type-check` clean; `pnpm lint` 0 errors / 83 warnings; `pnpm test` 74 files /
    563 tests (one pre-existing load flake in `timeLogsTableVirtual.test.tsx`, green in isolation — see
    Progress log); `pnpm build` green. Assess: `under_budget` → no review due.
  - Acceptance: all checks green; advisories closed or explicitly accepted; roadmap updated. ✅

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

## Review (RDD on)

- **Slice 2 (UX-601)** — base `e3c4242`, commit `13df113`, 15 paths / 523 lines: risk `medium`,
  `review_due_reason = slice_budget_reached`. Consent granted; lens `review-reliability`; lineage
  `review-e5bb65c401131367`. Result **approved**; acknowledgement burned authority. Advisories
  (non-blocking, queued as separate later work):
  - **R3-A11Y-HIDDEN-NAME (WARNING)** — reviewer flagged `SwitchDarkMode.tsx:17` `alt=""` as possibly
    dropping the checkbox's accessible name. **Verified non-defect:** the `<input>` keeps
    `aria-label={t('common.toggleDarkMode')}` (`SwitchDarkMode.tsx:28`), so the images are correctly
    decorative; the reviewer could not see attributes outside the changed hunk.
  - **R3-KEY-RESOLUTION-COVERAGE (WARNING)** — the new resolution test pins 12 keys; reused keys
    (`workTimeForm.progressInfo`, `tasks.tableTitle`, `common.description`, `common.cancel`) are not
    asserted to resolve. Queued: extend the resolution assertions.
  - **R3-NEGATIVE-ONLY-GUARD (SUGGESTION)** — the guard is a negative source-text scan; it cannot prove a
    component renders localized copy. Queued: add a render-level assertion.
  - **R3-SETTINGS-STALE-T (SUGGESTION)** — the mount-time settings-load effect closure keeps the `t`
    captured at mount, so a load failure after a language change reports in the previous locale. Accepted
    residual for a low-frequency error toast (adding `t` to deps would re-fetch and risk discarding edits).
  - **Advisory closure** — R3-KEY-RESOLUTION-COVERAGE and R3-NEGATIVE-ONLY-GUARD closed in `d622340`
    (reused-key resolution + interpolation + render-level assertions). R3-A11Y-HIDDEN-NAME verified
    non-defect. R3-SETTINGS-STALE-T accepted. No re-review was run (test/docs-only, `under_budget`).

- **Slices 3–5** — each assessed independently against its parent tip; all
  `review_due_reason = under_budget`, so no native review was due:
  - Slice 3 (UX-602, commit `4bcc96a`, 166 lines).
  - Slice 4 (UX-604, commit `81700ca`, 124 lines).
  - Slice 5 (closure, commit `d622340`, 145 lines).

## Delivery

- Strategy: `feature-branch-chain` (user-approved 2026-10-05). Tracker branch
  `feat/ux-fase-6-i18n-cleanup`; child slices off the tracker, one cohesive unit each; child PRs target the
  tracker. Slicing confirmed at PR time with one honest pass.
- Forecast: ~400–650 authored changed lines (locale keys dominate) across 4 tasks; actual ≈ 1.31k changed
  lines across 5 slices (a large share is new guard/test code, which the forecast underestimated).

| Slice | Task | Branch | Commit(s) | Lines |
| --- | --- | --- | --- | --- |
| 1 | UX-603 dead code | `feat/ux-fase-6-01-dead-code` | `e3c4242` | 349 |
| 2 | UX-601 hardcoded strings | `feat/ux-fase-6-02-i18n-strings` | `13df113` | 523 |
| 3 | UX-602 locales | `feat/ux-fase-6-03-locales` | `4bcc96a` | 166 |
| 4 | UX-604 action copy | `feat/ux-fase-6-04-action-copy` | `81700ca` | 124 |
| 5 | Closure (advisory hardening + roadmap) | `feat/ux-fase-6-05-closure` | `d622340` | 145 |

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
- 2026-10-05 — Slice 2 (UX-601) done: extracted every remaining hardcoded UI string to mirrored `en`/`es`
  keys across 15 files + new `fase6I18nGuard.test.ts` (14 tests, RED→GREEN). One new lint warning
  (settings mount effect exhaustive-deps) suppressed with rationale. Commit `13df113`
  (`feat/ux-fase-6-02-i18n-strings`), 523 lines. Native review (lens `review-reliability`) **approved**;
  acknowledgement burned authority; 4 advisories recorded (1 verified non-defect, 1 accepted, 2 queued for
  advisory closure). Assess `slice_budget_reached`.
- 2026-10-05 — Slice 3 (UX-602) done: translated 14 English leftovers in `es.ts`, resolved the
  `importCSV.colTaskName` divergence, removed 18 orphan keys (incl. `table.addRow`/`addFirstEntry`).
  New `fase6Locales.test.ts` (33 tests, RED→GREEN). Commit `4bcc96a` (`feat/ux-fase-6-03-locales`), 166
  lines. Assess `under_budget` → no review due.
- 2026-10-05 — Slice 4 (UX-604) done: unified action verbs (`Add`/`Save`) across 8 keys in both locales;
  new `fase6ActionCopy.test.ts` (18 tests, RED→GREEN); updated one a11y test for the now-shared
  opener/submit name. Commit `81700ca` (`feat/ux-fase-6-04-action-copy`), 124 lines. Assess `under_budget`.
- 2026-10-05 — Slice 5 (closure) done: closed the two queued slice-2 advisories in `fase6I18nGuard.test.ts`
  (reused-key resolution + interpolation + render-level AppBar/DeleteButton proofs); ticked
  `docs/UX-ROADMAP.md` Fase 6 (UX-601..604) and updated `Estado general`. Commit `d622340`
  (`feat/ux-fase-6-05-closure`), 145 lines. Assess `under_budget`.
- 2026-10-05 — Feature closure verification on the chain tip: type-check clean; lint 0 errors / 83 warnings;
  test 74 files / 563 tests (one pre-existing environmental load flake in `timeLogsTableVirtual.test.tsx`
  timeouts at 5s under full parallel load — green in isolation; both slice-1 and closure runs hit it, so it
  is NOT introduced by Fase 6 and is out of scope here); build green. Chained branches ready for push/PR
  (user-owned decision).
- Verification counts: baseline 71 files / 492 tests → 74 files / 563 tests (+4 test files:
  `fase6I18nGuard`, `fase6Locales`, `fase6ActionCopy`, plus the render additions; net +71 tests, −1 dead
  test removed in slice 1). Authored changed lines by slice: 349 / 523 / 166 / 124 / 145 = ~1307.
