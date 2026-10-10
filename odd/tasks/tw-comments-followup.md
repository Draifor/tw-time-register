# ODD Feature — TW Comments follow-up (close TC-6 advisories)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/tw-comments-followup/tasks`.

- **Feature:** `tw-comments-followup`
- **Branch:** `fix/tw-comments-followup` (off `origin/staging` @ `caef7b2`, the merge commit of PR #55)
- **Created:** 2026-10-10
- **Source:** user request — "Ya esta mergeado el PR. Solucionemos los follow-up."
- **Status:** **TASKS COMPLETE.** TF-1…TF-3 done in `5e504e7`; RDD assessment/review follows.

## Objective

Close the three non-blocking advisories left by the **TC-6 RDD review** of the `tw-comments`
feature (merged in PR #55). The three advisories were recorded as "separate later work" — this is
that work.

## Problem

The `tw-comments` listing shipped merged with three known, non-blocking defects:

- **R3-A** (`TaskCommentDialog.tsx`, WARNING) — `loadComments` writes every fetch result
  unconditionally. The append path ("Load more") adds a second async fetch trigger with no
  in-flight/out-of-order guard, so a late response can overwrite the current list.
- **R3-B** (`TaskCommentDialog.tsx`, WARNING) — the append failure branches (a resolved
  `{ success: false }` and a rejected promise) ship unproved by tests.
- **R3-C** (`apiService.ts`, SUGGESTION) — the fail-closed message `'Unexpected response from
  TeamWork'` is a hardcoded English literal, and the renderer prefers `result.message`, so it
  surfaces untranslated in `es`.

## Scope

**In scope (the three advisories only)**

- **TF-1 (R3-A)** — Add a stale-response / in-flight guard to `loadComments` so a superseded
  response never applies state (list, error, page, total) over a newer request.
- **TF-2 (R3-B)** — Cover the two append failure branches with RED→GREEN tests, plus a test that
  proves TF-1's guard (a stale replace response must not overwrite a newer list).
- **TF-3 (R3-C)** — Return a **stable machine code** from the main service on the fail-closed path
  and have the renderer map a present code to the localized `t('taskComment.commentsLoadError')`,
  so no untranslated English literal is surfaced. The existing `result.message` path for other
  errors is preserved.

**Out of scope**

- Editing/deleting comments; private-comment UI; @mentions; reactions; `tw_people` cache.
- Any behavior change to the add-comment send flow or the template/notify pickers.
- Localizing other pre-existing main-service English messages (not flagged).

## Constraints

- TypeScript strict; no `any`; conventional commits; English artifacts; no AI attribution.
- Full suite (`pnpm test`) must stay green; it is the regression floor.
- No TW payload change; no behavior change for unrelated flows.
- No push, no PR, no merge (user owns those).

## Verification mode

- **TDD:** RED → GREEN. Runner `pnpm test` (vitest).
- **Other gates:** `pnpm type-check`, `pnpm lint` (0 errors; pre-existing warnings OK), `pnpm build`.

## Authorized scope (candidate files)

- `src/renderer/components/TaskCommentDialog.tsx`
- `src/main/services/apiService.ts`
- `src/renderer/services/timesService.ts`
- `src/tests/renderer/TaskCommentDialog.test.tsx`
- `src/tests/main/services/apiService.test.ts`

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| TF-1 | R3-A: stale-response guard in `loadComments` (monotonic request ref). | `TaskCommentDialog.tsx` | delegated writer | [x] done (`5e504e7`) |
| TF-2 | R3-B: append-failure tests + stale-response guard test. | `TaskCommentDialog.test.tsx` | delegated writer | [x] done (`5e504e7`) |
| TF-3 | R3-C: stable fail-closed `code` + localized renderer message. | `apiService.ts`, `timesService.ts`, `TaskCommentDialog.tsx`, tests | delegated writer | [x] done (`5e504e7`) |

## Task detail (implementation spec)

### TF-1 — R3-A stale-response guard (`TaskCommentDialog.tsx`)

- Add `const commentsRequestIdRef = useRef(0);`.
- In `loadComments`, capture `const requestId = ++commentsRequestIdRef.current;` at the top.
- Start of a **replace** (`append === false`) also resets the append spinner
  (`setCommentsLoadingMore(false)`), so a replace supersedes an in-flight append cleanly.
- After `await fetchTWCommentsForTask(...)` (and in the `catch`), **bail without touching state**
  when `requestId !== commentsRequestIdRef.current` — a newer request owns the state.
- In `finally`, clear the loading flag only when `requestId === commentsRequestIdRef.current`.
- The success/error branch logic and the `[twTaskId, t]` dependency list stay unchanged; the ref
  does not affect `loadComments` identity, so the open effect does not loop.

### TF-2 — R3-B tests (`TaskCommentDialog.test.tsx`)

New cases in a `describe` for the follow-up:

1. **Append resolved failure**: page 1 returns 50 comments with `total: 60` (load-more shown);
   clicking "Load more" gets a resolved `{ success: false }` → `toast.error` with
   `t('taskComment.commentsLoadError')`, the page-1 list stays rendered, and the "Load more" button
   is still present and re-enabled (`commentsLoadingMore` cleared).
2. **Append rejected promise**: same shape, but the page-2 fetch rejects → same localized toast and
   the list is kept.
3. **Stale-response guard (TF-1)**: a slow replace response that resolves *after* a newer replace
   must not overwrite the newer list. Concrete: open with a deferred page-1 fetch (pending); close
   the dialog (Escape); reopen so a second fetch resolves with a *fresh* comment; then resolve the
   stale first fetch with a *stale* comment and assert the fresh comment is still shown and the
   stale one never appears.

### TF-3 — R3-C stable code + localized message

- `apiService.ts` `fetchTWCommentsForTask`: widen the return type with `code?: string`; on the
  fail-closed path (`!Array.isArray(rawComments) || statusFailed`) return
  `{ success: false, code: 'unexpected_response', message: 'Unexpected response from TeamWork' }`.
  Keep the `message` as the internal diagnostic.
- `timesService.ts` wrapper: widen the declared return type with `code?: string` (the preload/
  `window.Main` type is `Promise<any>`, so no other type change is needed).
- `TaskCommentDialog.tsx` non-append error branch: when `result.code` is present, use
  `t('taskComment.commentsLoadError')`; otherwise keep `result.message?.trim() || t(...)`.
- Tests: `apiService.test.ts` asserts `code: 'unexpected_response'` on the fail-closed cases
  (missing/non-array and non-OK `STATUS`); `TaskCommentDialog.test.tsx` asserts a
  `{ success: false, code: 'unexpected_response' }` result renders the localized
  `commentsLoadError` (verify under `es` so the result is the Spanish string, not the English
  literal).

## Acceptance criteria

- A superseded (stale) fetch response never overwrites or appends over a newer list.
- Both append failure branches are covered by tests and surface a localized toast.
- The fail-closed listing error shows a localized message (no raw English literal) in both `en`
  and `es`.
- `pnpm test` green, `pnpm type-check` clean, `pnpm lint` 0 errors, `pnpm build` OK.

## Delivery strategy

- Work-unit commits on `fix/tw-comments-followup`. Forecast: well under ~400 authored changed
  lines → `single-pr` / `ask-on-risk` default; no chaining needed. Push/PR/merge stay user-owned.

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| TF-1 | delegated writer | 2+ non-trivial files (dialog + apiService + timesService + 2 test files) |
| TF-2 | delegated writer | same writer unit (tests) |
| TF-3 | delegated writer | same writer unit |

## Progress

- 2026-10-10 — Feature opened from the user's request after PR #55 merged. Branch
  `fix/tw-comments-followup` off `origin/staging` @ `caef7b2`. No implementation yet.
- 2026-10-10 — **TF-1…TF-3 done** (`5e504e7`, one delegated writer, TDD RED→GREEN): R3-A
  stale-response guard, R3-B append-failure tests + stale-guard test, R3-C stable `code` +
  localized renderer message. See *Task verification* below.

## Task verification (2026-10-10, `5e504e7`)

- **TDD RED:** the 4 new failure-mode tests failed against the pre-change production code
  (`Tests 4 failed | 683 passed (687)`): the stale-replace guard, the `es` localized load error,
  and the two `code: 'unexpected_response'` assertions. The two append-failure tests pin
  already-shipped R3-B behavior, so they passed pre-change.
- **GREEN:** focused re-run after the fix → `82 files / 687 tests passed`.
- **Gates:** `pnpm test` 82 files / 687 tests passed; `pnpm type-check` clean; `pnpm lint` 0 errors
  (83 pre-existing warnings); `pnpm build` OK. Orchestrator spot check: `pnpm test` 82 / 687 pass.
- **Normalization:** `pnpm lint:fix` ran before freeze and produced no byte change (convergent).

## Next

- RDD assessment on `5e504e7` (base `caef7b2`, `--committed-only`), then the native review if due.
- Delivery: branch `fix/tw-comments-followup` → push + PR (user-owned). Merge stays with the user.

## Evidence files

- `src/renderer/components/TaskCommentDialog.tsx` — `loadComments` (R3-A, R3-B, R3-C renderer).
- `src/main/services/apiService.ts` — `fetchTWCommentsForTask` fail-closed path (R3-C).
- `src/renderer/services/timesService.ts` — wrapper return type (R3-C).
- `odd/tasks/tw-comments.md` — the original merged feature (source of these advisories).
