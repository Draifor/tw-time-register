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

- [ ] **T1** — Partial-prefix registration: `WorkTimeForm.tsx` (submit partition + persist + reindex + timer remap + conditional draft clear + overtime scope) and `TotalTimeDay.tsx` (refresh token) and `locales/en.ts`/`locales/es.ts` (toast keys). *delegated writer*
- [ ] **T2** — Tests covering AC1–AC8 in `src/tests/renderer/workTimeFormSubmit.test.tsx`. *delegated writer, same work unit*
- [ ] **T3** — Verification (`pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm build`), work-unit commit, RDD assess. *parent*
- [ ] **T4** — Close doc with evidence. *parent*

## Checks

- `pnpm test`
- `pnpm type-check`
- `pnpm lint`
- `pnpm build`

## Progress / evidence

- (pending)

## Next step

Delegate T1+T2 to a bounded writer, then verify and commit.
