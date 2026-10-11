# ODD Feature — Partial time registration (valid prefix)

- **Feature:** partial-time-registration
- **Branch:** `feat/partial-time-registration` (base: `origin/staging` @ `14ed643`, the merge of PR #56)
- **Started:** 2026-10-10
- **Route:** delegated direct (one writer) — 2+ non-trivial files (`WorkTimeForm.tsx`, `TotalTimeDay.tsx`) plus locales and tests. Writer trigger fired.
- **Delivery strategy:** `single-pr` (forecast ~180–260 authored changed lines, under the ~400 budget)
- **Decision:** automatic partial save of the **valid leading prefix** (no confirm dialog, no per-row button).

## Objective

When the user registers work time and the trailing rows are incomplete (still in progress),
persist the **valid leading rows** instead of blocking the whole submit, and keep the
incomplete rows in the form as draft — without disturbing the time cascade of the rows
that remain.

## Problem

`WorkTimeForm` uses react-hook-form. Every row has 5 required fields (`description`,
`task`, `date`, `hours`, `startTime`). `handleSubmit(onSubmit)` validates **all** rows;
if a single row is incomplete, `onSubmit` never runs and **nothing is saved**.

## Why

The last rows are usually the ones still being worked on, so the all-or-nothing submit
leaves the whole day unregistered. The user needs to register what is already complete
and keep the rest as draft.

## Scope

**In:**
- `WorkTimeForm.tsx`: `handleSubmit(onValid, onInvalid)`; the invalid path computes the
  valid prefix and persists it; removes the saved rows from the form; re-indexes the
  cascade tracker; remaps the active timer; clears the draft only when no rows remain;
  runs the max-hours check only over the rows being saved.
- `TotalTimeDay.tsx`: force a daily-info refresh after a partial save so the saved/draft
  split is not stale when the remaining rows share the same date.
- `locales/en.ts`, `locales/es.ts`: toast keys for the partial-save outcome.
- Tests: extend `src/tests/renderer/workTimeFormSubmit.test.tsx`.

**Out (explicit):**
- No changes to TeamWork sync — saved rows are pending (`isSent = false`) and sync as today.
- No confirm dialog and no separate per-row register button (decided: automatic).
- No changes to the validation rules themselves.

## Acceptance criteria

- **AC1** All rows valid → unchanged behavior: full save, form resets to one default entry, draft cleared.
- **AC2** Valid prefix + invalid trailing rows → only the valid prefix is persisted via `addTimeEntries`; invalid rows remain in the form; a toast reports saved vs kept.
- **AC3** The remaining rows keep their existing `startTime`/`endTime` — the cascade does **not** re-shift them.
- **AC4** `activeTimer.index` is remapped after removing rows; the timer survives when its row remains, and is cleared when its row was saved.
- **AC5** Draft is cleared only when no rows remain; otherwise the remaining rows persist as draft.
- **AC6** First row invalid → nothing is saved and errors are shown (no partial).
- **AC7** `TotalTimeDay` reflects the new saved/draft split after a partial save (same-date case).
- **AC8** The max-hours (overtime) check runs only over the rows being saved.

## Tasks

- [x] **T1** — Partial-prefix registration: `WorkTimeForm.tsx` (submit partition + persist + reindex + timer remap + conditional draft clear + overtime scope) and `TotalTimeDay.tsx` (refresh token) and `locales/en.ts`/`locales/es.ts` (toast keys). Done in `7955426`. *delegated writer*
- [x] **T2** — Tests covering AC1–AC6 in `src/tests/renderer/workTimeFormSubmit.test.tsx`. Done in `7955426`. *delegated writer, same work unit*
- [x] **T3** — Verification (`pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm build`), work-unit commit, RDD assess. *parent*
- [x] **T4** — Close doc with evidence. *parent*

## Checks

- `pnpm test`
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`

## Progress / evidence

- Work-unit commit `7955426` (base `origin/staging` @ `14ed643`): 6 files, 450 insertions, 43 deletions.
- TDD: RED — `pnpm exec vitest run src/tests/renderer/workTimeFormSubmit.test.tsx` → 2 failed | 4 passed (the two partial-path tests timed out because today a partial submit saves nothing). GREEN — 6 passed.
- Writer verification: `pnpm type-check` exit 0; `pnpm lint` 0 errors (83 pre-existing warnings); `pnpm test` 82 files / 691 tests passed; `pnpm build` exit 0.
- Parent spot check: focused test file 6/6 passed; `pnpm lint:fix` no-op.
- RDD assess (`--base-ref 14ed643 --committed-only`): risk `medium`, `review_due: true` (`slice_budget_reached`, 493 changed lines).
- Native review (lineage `review-20cfe08c42ffb5f8`, lens `review-reliability`): **approved**, authority burned (`gentle-ai.review-acknowledged/v1`, consumed revision `sha256:b3d2e167f03ec06d2022690c53714edde9c8504d9b7c7e5b5acf17ae5180bf66`).

### Implementation deviation (accepted)

Rows are dropped with `reset({ entries })` instead of `useFieldArray.remove()`, because RHF's `remove` does not re-emit form values, leaving `useWatch('entries')` stale and letting the time cascade write past the shrunk array. A length guard was added to the cascade effect. Verified by the writer against RHF 7.89 source and covered by tests.

### Advisory follow-ups (non-blocking, from the approved review)

- R3-1: AC7 (TotalTimeDay refresh) and AC8 (overtime scope) have no dedicated test; the partial-save toast is never asserted.
- R3-2: `onInvalid` treats a missing/non-array `errors.entries` as "all rows valid" (fail-open). Consider failing closed.
- R3-3: the timer remap writes state/localStorage but not `activeTimerRef.current` at the remap site.
- R3-4: the cascade length guard skips the cascade on any transient desync with no observable signal.

## Follow-up closure work unit (F1–F4)

Closing the four advisory findings from the approved review, on the same branch,
as a second work unit before delivery.

- **Route:** delegated direct (one writer) — 2+ non-trivial files
  (`src/renderer/components/WorkTimeForm.tsx`, `src/tests/renderer/workTimeFormSubmit.test.tsx`
  + new `src/tests/renderer/totalTimeDayRefresh.test.tsx`). Writer trigger fired.
- **Delivery strategy:** still `single-pr` (this work unit forecast ~120–200 authored changed lines).

### Follow-up tasks

- [x] **F1 (R3-1)** — Dedicated test coverage: AC7 (`TotalTimeDay` refresh) and AC8 (overtime
  scope over saved rows only); assert the partial-save toast. Done in `b7b87d2`.
- [x] **F2 (R3-2)** — `onInvalid` fails closed when the per-row error shape is unusable, via an
  exported pure `validPrefixCount` helper. Done in `b7b87d2`.
- [x] **F3 (R3-3)** — Timer remap writes `activeTimerRef.current` synchronously at the remap site
  (and the two sibling index-mutating sites) so the ref never lags the state. Done in `b7b87d2`.
- [x] **F4 (R3-4)** — Make the cascade length guard observable with a dev-only warning. Done in `b7b87d2`.
- [x] **F5** — Verification (`pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm build`), work-unit
  commit, RDD assess. *parent*

### Follow-up closure evidence

- Work-unit commit `b7b87d2` (base `4eb2b86`): 3 files, 231 insertions, 10 deletions.
- TDD: RED — focused files 2 failed | 9 passed (both failures `validPrefixCount is not a function`).
  GREEN — 2 files, 11 tests passed. F3 (ref sync) and F4 (dev warning) have no meaningful runnable
  RED; the existing AC4 timer-remap test and the focused file stay green instead.
- Writer verification: `pnpm type-check` exit 0; `pnpm lint` 0 errors (83 pre-existing warnings);
  `pnpm test` 83 files / 696 tests passed; `pnpm build` exit 0.
- Parent spot check: focused `workTimeFormSubmit` + `totalTimeDayRefresh` 11/11 passed.
- RDD assess (`--base-ref 4eb2b86 --committed-only`): risk `medium`, `review_due: false`
  (`under_budget`, 241 changed lines). No native review required for this slice.

## Next step

Delivery: open the PR from `feat/partial-time-registration` into `staging` (user-owned).
