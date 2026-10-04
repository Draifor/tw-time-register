# ODD — UX Fase 4: Flows, feedback and states

- **Feature:** UX Fase 4 of [`docs/UX-ROADMAP.md`](../../docs/UX-ROADMAP.md) (UX-401..UX-409)
- **Branch:** `feat/ux-fase-4-flows` (base: `origin/staging` @ PR #27 merge `1bb6d48`)
- **Started:** 2026-10-04
- **Route:** delegated direct (one writer per work unit); parent owns tracking docs and review orchestration
- **Delivery strategy:** `feature-branch-chain` (user-approved 2026-10-04). Tracker branch
  `feat/ux-fase-4-flows`; child PRs target the tracker/parent branch. Planned slices:
  (1) UX-405+UX-401, (2) UX-402/406+UX-403, (3) UX-404+UX-407, (4) UX-408+UX-409+advisory closure.
  Final line counts confirmed at PR time with one honest slicing pass (≤400 lines per PR where cohesive).
- **RDD:** on (global). Assessment + native review apply per work unit; reviewed boundary advances on acknowledgement.
- **Runner:** `pnpm test` (Vitest). Checks: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

## Objective

Make every flow tell the user what is happening and stop accidental destructive actions: robust submit,
confirmed deletion, consistent empty/loading/error states, safe wizards, no debug panel, semantic validation,
and one unified 24h time format.

## Resolved product decision

- **Time format (UX-407):** **24h everywhere** (user-approved 2026-10-04). Single format across inputs,
  tables and reports; no locale-dependent 12h/24h switch.

## Problem (roadmap audit, evidence path:line — may drift)

- **UX-401:** `WorkTimeForm.tsx:529-539,1360` — primary submit has no `isSubmitting`/disabled state → double submit.
- **UX-402:** `WorkTimeForm.tsx:290-299,1271-1283` — delete entry / `Ctrl+Escape` bulk delete with no confirmation or undo.
- **UX-403:** `HomePage.tsx:46,58` (`catch {}` silent) → Home shows zeros instead of an error; `DataTable`/`TimeLogsTable` lack translated loading/error states.
- **UX-404:** `PullFromTWDialog.tsx:256-549`, `ImportTasksDialog.tsx:291,307-605`, `PullTaskDialog.tsx` — no step indicator; overlay/ESC can close mid-operation.
- **UX-405:** `PullFromTWDialog.tsx:325-364` + `handleDebug` `:202-219` — raw "Debug API" JSON panel in production UI.
- **UX-406:** `DeleteEntryDialog.tsx:17-40` — uses `Dialog`, not `AlertDialog`; no `role="alertdialog"`/initial focus on confirm.
- **UX-407:** `WorkTimeForm.tsx:400` (`H:i`) vs `:414,433` (`h:i K`); `time-picker.tsx:61` uses `H:i`; mixed formats.
- **UX-408:** `WorkTimeForm.tsx:307,317,381,405,313,378,421`, `TasksTable.tsx:151,170`, `TypeTasksTable.tsx:82` — no `aria-invalid`/`aria-describedby`; some error copy hardcoded.
- **UX-409:** `TimeLogsTable.tsx:406,475`, `WorkTimeForm.tsx:1072-1077` — evaluate optimistic feedback case by case.

## Scope

**In:** WorkTimeForm submit/delete/time/validation, HomePage error state, DataTable + TimeLogsTable states,
empty-state primitives (add `LoadingState`), PullFromTWDialog + ImportTasksDialog + PullTaskDialog wizards,
DeleteEntryDialog, 24h formatting, locale copy.

**Out (later phases):** deep a11y (combobox ARIA, label↔control association, focus ring sweep — Fase 5),
i18n dead-string sweep and dead-code cleanup (Fase 6), Reports backlog (Fase 7), WorkTimeForm calculation
logic, E2E visual tests.

## Tasks

- [x] **T1 · UX-405 — Remove "Debug API" from the UI** — ✅ 2026-10-04, commit `b9a02a1`
  - Remove the debug panel + `handleDebug`/`isDebugging`/`debugData`/`debugRawTWEntries` import from `PullFromTWDialog.tsx`.
  - Acceptance: no debug panel or debug state remains; no unused import/state (lint clean).

- [x] **T2 · UX-401 — Robust submit in WorkTimeForm** — ✅ 2026-10-04, commit `c231492`
  - `isSubmitting` state around the save handler; primary button `disabled` + spinner while pending; guard double submit.
  - Test-first: renderer test asserting the primary button is disabled / shows pending during an in-flight save.
  - Acceptance: double click cannot create duplicates; the button reflects the pending state.

- [x] **T3 · UX-402 + UX-406 — Confirm deletion (AlertDialog)** — ✅ 2026-10-04, commit `17841cd`
  - Delete entry and the `Ctrl+Escape` bulk delete go through an `AlertDialog` confirmation; `DeleteEntryDialog` migrates from `Dialog` to `AlertDialog` (`role="alertdialog"`, initial focus on confirm, `AlertDialogDescription`).
  - Test-first: renderer test asserting delete is not committed until confirmed.
  - Acceptance: no entry is lost by an accidental click/key; every deletion path uses `AlertDialog`.

- [x] **T4 · UX-403 — Consistent, translated empty/loading/error states** — ✅ 2026-10-04
  - Add a shared `LoadingState` to `ui/empty-state.tsx`; adopt `EmptyState`/`ErrorState`/`LoadingState` in HomePage, DataTable and TimeLogsTable with i18n copy.
  - `HomePage`: replace silent `catch` with a real error state (surface the failure, offer retry).
  - Test-first: Home error path renders `ErrorState` (not zeros).
  - Acceptance: every data view has the three states, translated.

- [x] **T5 · UX-404 — Wizards: step indicator and safe close** — ✅ 2026-10-04
  - Visible stepper in `PullFromTWDialog` + `ImportTasksDialog` (+ `PullTaskDialog` where it has steps); block overlay/ESC while an operation is in flight; initial focus on the first control.
  - Acceptance: the user knows the step and cannot close a destructive in-flight operation.

- [x] **T6 · UX-407 — Unify time format to 24h** — ✅ 2026-10-04
  - Replace all 12h (`h:i K`) usage with 24h (`H:i`/`HH:mm`); one formatter path; align `time-picker`, `WorkTimeForm`, `TimeLogsTable`, `PullFromTWDialog`.
  - Test-first: a formatter/entry test asserting 24h output (e.g. `14:30`, never `2:30 PM`).
  - Acceptance: one format and one picker across the app.

- [x] **T7 · UX-408 — Semantic validation and consistent required** — ✅ 2026-10-04
  - `aria-invalid` + `aria-describedby` on invalid fields; i18n error messages (no hardcoded); required marker where applicable.
  - Acceptance: errors are announced and consistent.

- [x] **T8 · UX-409 — Optimistic feedback where it applies** — ✅ 2026-10-04
  - Evaluate `TimeLogsTable`/`WorkTimeForm` mutations case by case; improve perceived latency without desyncing data.
  - Acceptance: frequent actions feel instant without stale data.

- [x] **T9 · Advisory closure (reviews 1–4)** — ✅ 2026-10-04
  - Code: `input-form` native `required` passthrough; `input-date` symmetric `aria-required` removal;
    `formatTime24h` returns the raw trimmed value for unknown non-empty shapes (no fabricated `00:00`).
  - Tests: submit rejection path; daily-load failure + retry success; Esc/timer/lastRemoved; wizard
    ImportTasksDialog + PullTaskDialog in-flight guards; rejected pull releases busy; deterministic overlay;
    TimeLogsTable 24h wiring + em-dash; formatter fallback/clamp; TasksTable/TypeTasksTable a11y;
    locale pinned (`i18n.changeLanguage('en')`) and mocks reset per case.

## Authorized files

- `src/renderer/components/WorkTimeForm.tsx`
- `src/renderer/components/DeleteEntryDialog.tsx`
- `src/renderer/pages/HomePage.tsx`
- `src/renderer/components/DataTable.tsx`
- `src/renderer/components/TimeLogsTable.tsx`
- `src/renderer/components/ui/empty-state.tsx`
- `src/renderer/components/PullFromTWDialog.tsx`
- `src/renderer/components/ImportTasksDialog.tsx`
- `src/renderer/components/PullTaskDialog.tsx`
- `src/renderer/components/TasksTable.tsx`
- `src/renderer/components/TypeTasksTable.tsx`
- `src/renderer/components/ui/time-picker.tsx`
- `src/renderer/components/ui/input-time.tsx`
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `src/tests/renderer/**` (new/updated tests)

## Checks

```pwsh
pnpm lint
pnpm type-check
pnpm test
pnpm build
```

Task-specific: submit button disabled during pending (T2); delete requires confirmation (T3); Home error
state on failure (T4); no debug panel (T1); 24h output (T6); `aria-invalid` + described-by (T7).

## Review (RDD on)

- **Slice T1+T2** (base `1bb6d48`, commits `b9a02a1`+`c231492`, 7 paths / 416 lines): `review_due_reason =
  slice_budget_reached`. Consent granted; lens `review-reliability`; lineage `review-bf4b0951e0f684a9`.
  Result **approved**; acknowledgement burned authority. Reviewed boundary now `c231492`.
  - **R3-001 (WARNING, informational)** — the new submit test only settles the deferred save with success;
    the failure path of the `finally` reset (`isSubmittingRef`/`isSubmitting` after a rejected save) is
    unproved. Follow-up: add a rejection-path test case.
  - **R3-002 (SUGGESTION, informational)** — the pending-label assertion matches English text only and does
    not pin the active locale. Follow-up: pin the language in the test.

## Progress log

- 2026-10-04 — User merged PR #27 (Fase 0) into `staging`; authorized Fase 4. Product decision UX-407 resolved
  (24h everywhere). Branch `feat/ux-fase-4-flows` created from `origin/staging` (`1bb6d48`). Task doc created.
- 2026-10-04 — T1 (UX-405) done: removed the Debug API panel/trigger/handler/state/import from
  `PullFromTWDialog.tsx` (no debug-only locale keys existed); added a regression guard. Commit `b9a02a1`.
- 2026-10-04 — T2 (UX-401) done: `isSubmitting` state + sync ref guard, disabled/spinner button, `saving`
  locale key. Test-first RED→GREEN (`workTimeFormSubmit.test.tsx`); full suite 57 files / 393 tests green.
  Commit `c231492`. Native review approved (see above).
- 2026-10-04 — T3 (UX-402+UX-406) done: one reusable `AlertDialog` confirms draft-row removal in
  `WorkTimeForm` (per-row + Esc shortcut); `DeleteEntryDialog` migrated `Dialog`→`AlertDialog`
  (`role="alertdialog"`, description, focus on confirm, in-flight non-dismissible). Test-first RED→GREEN
  (`deleteConfirm.test.tsx`, 4 tests). Commit `17841cd`.
- 2026-10-04 — T4 (UX-403) done: shared `LoadingState` + optional `ErrorState.action`; `HomePage` surfaces
  load failures with `ErrorState` + retry (no more silent zeros) and uses `LoadingState`; both tables'
  filtered-empty variants use the shared `EmptyState` (both already had empty/loading/error). Test-first
  RED→GREEN (`homeErrorState.test.tsx`). Full suite 59 files / 402 tests green.
- 2026-10-04 — T4 slice reviewed: lineage `review-ed2b0b52fadcee35`, **approved**, boundary `1f41ea1`.
  Advisories: R3-001 (daily-load failure branch unproved), R3-002 (tests don't pin locale),
  R3-003 (Esc/timer/lastRemoved sub-paths unpinned). Queued for advisory closure.
- 2026-10-04 — T5 (UX-404) done: accessible `WizardStepIndicator` + in-flight close guards
  (Escape/overlay/close-X) + initial focus in `PullFromTWDialog`, `ImportTasksDialog`, `PullTaskDialog`;
  the stepper was then extracted to shared `ui/wizard-step-indicator.tsx`. Test-first RED→GREEN
  (`wizardStepper.test.tsx`). Full suite 60 files / 405 tests green.
- 2026-10-04 — T6 (UX-407) done: shared `formatTime24h()` in `lib/timeUtils.ts`; `WorkTimeForm` start/end
  flatpickr pickers `h:i K`+`time_24hr:false` → `H:i`+`time_24hr:true`; `toTimeEntryInputs` drops
  locale-dependent `toLocaleTimeString`; `TimeLogsTable` start/end cells use the helper. Test-first
  RED→GREEN (`timeFormat24h.test.tsx`, 8 tests). Full suite 61 files / 413 tests green.
- 2026-10-04 — T6 slice reviewed: lineage `review-efba9156f48265fe`, **approved**, boundary `107af7d`.
  Advisories R3-001..R3-006 (wizard/guard coverage gaps, formatter boundaries, TimeLogsTable 24h wiring).
  Queued for advisory closure.
- 2026-10-04 — T7 (UX-408) done: `aria-invalid`/`aria-describedby`/`aria-required` on WorkTimeForm
  (description, date, hours, startTime, task), TasksTable + TypeTasksTable add-forms, and the custom
  controls (`input-form`/`input-time`/`input-date`/`combobox`/`textarea-form`); `descriptionRequired`
  moved to i18n + `common.required`. Test-first RED→GREEN (`formValidationA11y.test.tsx`, 5 tests).
  Full suite 62 files / 418 tests green.
- 2026-10-04 — T7 slice reviewed: lineage `review-054d0f147b9d1ea9`, **approved** (first capture malformed;
  slot re-offered and relaunched), boundary `6004740`. Advisories R3-001..R3-004 (table add-form coverage,
  `input-form` native `required` dropped, `input-date` stale aria-required, test order-sensitivity).
- 2026-10-04 — T8 (UX-409) done: optimistic update for task edit (`useTasks.onEdit`) and TimeLogsTable
  inline-edit save (cache patch + rollback + settle invalidation); other mutations deliberately left
  (destructive/server-authoritative/server-generated ids). Test-first RED→GREEN
  (`useTasksOptimistic.test.tsx`, `optimisticFeedback.test.tsx`). Full suite 63 files / 420 tests green.
- 2026-10-04 — T9 advisory closure done: 3 code fixes + 16 tests closing the review-1..4 advisories;
  locale pinned and mocks reset per case. Full suite 63 files / 436 tests green.
