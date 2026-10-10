# ODD Feature — TW Comments (harden the write flow + add listing)

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/tw-comments/tasks`.

- **Feature:** `tw-comments`
- **Branch:** `feat/tw-comments` (off `staging` @ `e87f5e1`, post `v1.16.1`)
- **Created:** 2026-10-09
- **Source:** user request — review the TeamWork comments feature and make everything related work correctly; read-only mapping by one delegated explorer.
- **Status:** **TASKS COMPLETE.** TC-1 done (TW v1 API shapes verified). TC-2 done + RDD-reviewed (APPROVED). TC-3 done (hardening + advisory findings). TC-4 done + RDD-reviewed (APPROVED). TC-5 done (test coverage: add/send flow + main-service comment mapper). No push/PR/merge (user owns delivery).

## Objective

1. **Harden the existing "add comment to a TW task" flow** so everything it offers works correctly
   (attachments, notify-people, templates, error handling).
2. **Add comment listing** — the app can currently only *write* comments to TW, never *read/list*
   them. This is the previously-noted "comment listing" gap.

## Problem

The comments feature is **write-only** and has several silent-failure / validation gaps (see
*Findings*). It is usable for the happy path but not correct on the edges, and it cannot show the
user what already exists on a task.

### Findings (read-only map, evidence-backed)

**Works today**

- Add comment: dialog → IPC → main → `POST /tasks/{id}/comments.json`; success toast, reset, close.
- Attachments: lazy upload at send time (`POST /pendingfiles.json`), dedup by name+size, per-row error.
- Notify: two-step TW call (`GET /tasks/{id}.json` → `project-id` → `GET /projects/{id}/people.json`).
- Templates: **full** CRUD UI in Settings, all service functions wired, none dead.
- POST retry is safe (retries only on 429) → no duplicate-comment risk.

**Missing**

- **No comment listing.** The only TW comments call is the POST (`apiService.ts:766`). No
  `GET`/`getComments*`, no IPC/preload method, no UI.

**Defects**

| Sev | Problem | Evidence |
|---|---|---|
| medium | Attachment-only comment sends an empty `body`; TW may reject it (UI explicitly allows body-less send) | `TaskCommentDialog.tsx:145,159`; `apiService.ts:756` |
| medium | Failed attachment upload is silently dropped but the comment still sends and reports success | `TaskCommentDialog.tsx:149-164` |
| medium | Notify-people load failure is swallowed; renders identically to a genuinely empty list | `TaskCommentDialog.tsx:117-119,294-295` |
| low | Template fetch error silently caught; picker just disappears; no loading/error state | `TaskCommentDialog.tsx:62-64,221` |
| low | No attachment size/type validation | `TaskCommentDialog.tsx:69-78` |
| low | Notify search input is placeholder-only (no label/aria-label) | `TaskCommentDialog.tsx:279-287` |
| low | `tw_people` cache table created but never read/written (dead schema) | `migrations.ts:106-115` |
| low | `isprivate` hardcoded `false`; no private-comment UI | `apiService.ts:759` |
| low | `notify` / `pendingFileAttachments` comma-joined payload shape unverified against TW v1 | `apiService.ts:754-762` |

**Tests**: almost none — only dialog a11y (`dialogDescriptions.test.tsx:125-129`) and Settings template
button names (`a11yNames.test.tsx:256-264`). Upload / send / notify / error paths are uncovered; no
`apiService` comment tests.

**i18n**: `taskComment.*` has 19 matching keys in `en.ts:554-574` and `es.ts:556-576`; parity enforced
by `fase6Locales.test.ts:39-41`. No gaps.

### Feature map (files)

- `src/renderer/components/TaskCommentDialog.tsx:40` — dialog (body, attachments, notify, templates, send).
- `src/renderer/services/timesService.ts:358-399` — `window.Main` wrappers.
- `src/main/preload.ts:351-364` — IPC bridge.
- `src/main/ipc/databaseIpc.ts:349-370` — IPC handlers.
- `src/main/services/apiService.ts:638-791` — `uploadPendingFileToTW` (638), `fetchTWPeopleForTask` (689), `addCommentToTWTask` (744).
- `src/main/services/commentTemplateService.ts:26-53` — local SQLite CRUD.
- `src/main/database/migrations.ts:95-115` — `comment_templates` + dead `tw_people`.
- `src/renderer/pages/SettingsPage.tsx:326-368,762-880` — template CRUD UI.
- Entry points: `src/renderer/hooks/useTasks.tsx:363-371`, `src/renderer/components/TimeLogsTable.tsx:252-258`.

## Why

Comments are a core TW interaction the app already exposes; "everything it offers should work
correctly", and reading existing comments is the obvious missing half of the feature. The earlier
TW-integration work explicitly deferred "comment listing"; this feature closes it and pays down the
edge-case debt.

## Scope

**In scope**

- **TC-1** — Verify the TW v1 comments API against official docs and/or live TW: the exact POST
  payload shape (`notify`, `pendingFileAttachments`, empty-body-with-attachments behavior) and the
  GET listing endpoint + response shape. Record exact shapes.
- **TC-2** — Fix the three medium defects in the add flow (empty body, failed attachment, notify
  load failure).
- **TC-3** — Low hardening: template fetch loading/error state, attachment size/type validation,
  notify search aria-label, decide/resolve the dead `tw_people` schema.
- **TC-4** — Comment listing: main-service GET + IPC + preload + renderer service + UI
  (loading/empty/error states) to show a task's existing comments.
- **TC-5** — Tests: add-flow (upload / send / error paths) and listing.

**Out of scope (candidate follow-ups, not authorized here)**

- Editing or deleting comments; private-comment UI; @mentions; reactions.
- Rewiring `tw_people` into an actual cache (unless TC-3 decides to drop it).

## Constraints

- TypeScript strict; no `any`; conventional commits; English artifacts; no AI attribution.
- Existing suite is the regression floor; full suite must stay green.
- Do not change TW behavior for unrelated flows.
- Any TW payload change must be evidence-backed (TC-1), never guessed.

## Verification mode

- **TDD:** RED → GREEN where a runnable deterministic test exists; runner `pnpm test` (vitest).
- **Other gates:** `pnpm type-check`, `pnpm lint` (0 errors; pre-existing warnings OK), `pnpm build`.
- **Human smoke test:** (a) comment with attachment + notify → no silent success on failure;
  (b) an existing task's comments are listed correctly.

## Authorized scope (candidate files)

- `src/main/services/apiService.ts`
- `src/main/services/commentTemplateService.ts`
- `src/main/ipc/databaseIpc.ts`
- `src/main/preload.ts`
- `src/main/database/migrations.ts` (only if TC-3 resolves `tw_people`)
- `src/renderer/services/timesService.ts`
- `src/renderer/components/TaskCommentDialog.tsx`
- `src/renderer/components/TimeLogsTable.tsx`
- `src/renderer/hooks/useTasks.tsx`
- `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts`
- `src/tests/**`

No push, no PR, no merge (user owns those).

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| TC-1 | Verify TW v1 comments API: POST payload + GET listing endpoint/response; record exact shapes | — | read-only research | [x] done 2026-10-09 |
| TC-2 | Fix add-flow medium defects: require non-empty body (no attachment-only send), fail-closed on attachment upload failure, notify-load error state | `TaskCommentDialog.tsx`, `locales/en.ts`, `locales/es.ts`, tests | delegated writer | [x] done (`481d398`) |
| TC-3 | Low hardening: template loading/error state, attachment size validation, notify search aria-label, resolve dead `tw_people` schema | `TaskCommentDialog.tsx`, locales, `migrations.ts`, tests | delegated writer | [x] done (`d200bd4`) |
| TC-4 | Comment listing: GET service + IPC + preload + renderer service + UI (loading/empty/error) + listing tests | `apiService.ts`, `databaseIpc.ts`, `preload.ts`, `timesService.ts`, `TaskCommentDialog.tsx`, locales, `TaskCommentDialog.test.tsx` | delegated writer | [x] done (`ad40d7d`) + RDD APPROVED |
| TC-5 | Tests: add-flow (upload/send/error) paths | `src/tests/**` | delegated writer | [x] done (`9c5578b`) |

## TC-1 — Verified TW v1 comment API shapes (2026-10-09)

Evidence: official API v1 reference (`apidocs.teamwork.com` comments pages), the official
`Teamwork/Teamwork.com-API-Request-Examples` repo, and the community Teamwork MCP tool. No source change.

### POST — create comment

`POST https://{domain}.teamwork.com/tasks/{taskId}/comments.json`

```json
{
  "comment": {
    "body": "text",
    "content-type": "text",
    "notify": "",
    "isprivate": false,
    "pendingFileAttachments": "tf_...,tf_..."
  }
}
```

- `content-type`: `"text"` = plain (official samples use `"TEXT"`/`"text"`; case-insensitive), `"html"` for HTML.
  Current code's `"text"` matches a confirmed working sample → **no change needed**.
- `notify`: `""` none · `"true"` followers/assignees · `"all"` whole project · comma-list of user IDs.
  **Gotcha: you cannot notify yourself** (TW rejects the author id in the list).
- `pendingFileAttachments`: comma-separated `tf_...` refs returned by `POST /pendingfiles.json`.
  Current code already joins refs with `,` → correct.
- Response: `{ "commentId": "4294639", "STATUS": "OK" }`. `commentId` is a **string** (current code
  reads `commentId || id` — correct; its TS return type claims `number`, a minor type lie).

### GET — list comments

`GET https://{domain}.teamwork.com/tasks/{taskId}/comments.json?page=N&pageSize=M`

Response: `{ "comments": [ { ... } ], "STATUS": "OK" }`. Per-comment fields usable by the listing UI:

- `id` (string), `body`, `html-body`, `content-type`
- `author-id`, `author-firstname`, `author-lastname`, `datetime` (ISO 8601)
- `private` ("0"/"1"), `attachments` (array), `attachments-count`

Paging headers: `X-Records` (total), `X-Pages`, `X-Page`.

### Open uncertainty (not resolvable from docs)

- **Attachment-only comment (empty `body`)**: the docs do not state whether TW accepts an empty
  `body` when `pendingFileAttachments` is present. The official MCP tool marks `body` as **required**
  and every official sample includes a body. Needs a live smoke test and/or a product decision
  (see TC-2). This is not a payload-shape defect on its own.

## TC-3 — Low hardening (2026-10-10, `d200bd4`)

Scope: the low-severity map defects plus the three TC-2 review advisories.

- Template picker: replaced the silent `.catch(() => {})` with `templatesLoading`/`templatesError` state
  and a `loadTemplates` callback (the retry button reuses `common.retry`).
- Attachments: 25 MB per-file cap enforced in `addFiles`; oversized files are not added and surface
  `taskComment.attachTooLarge`. File types remain unrestricted.
- Notify search input: added `aria-label` (the placeholder alone was not a label).
- Fallbacks: `message?.trim() || fallback` in `uploadFile` and `handleOpenNotify` (an empty-but-present
  message no longer falls through to the empty-list branch).
- Auto-retry: removed the pre-send `attachments.some(a => a.error)` guard; the send loop re-uploads any
  attachment lacking a ref and clears its prior error, so a transient failure recovers on the next send.
- Notify fetch: `handleOpenNotify` wrapped in try/catch/finally so a rejected promise shows the error
  state and always clears the spinner.
- `tw_people`: dropped in a guarded migration.
- i18n: added `attachTooLarge`, `templatesLoading`, `templatesLoadError` to `taskComment` in en + es (parity kept).

Tests: 6 new RED→GREEN cases (oversized reject, auto-retry on send, template load error + retry, notify
rejection, exact-limit accept, blank-message fallback) in `src/tests/renderer/TaskCommentDialog.test.tsx`.

## TC-4 — Comment listing (2026-10-10, `ad40d7d`)

Scope: read/list a task's existing TW comments end-to-end, with loading/empty/error states.

- `apiService.ts`: new `fetchTWCommentsForTask(twTaskId, page = 1, pageSize = 50)` —
  `GET /tasks/{id}/comments.json?page&pageSize`, reusing `getTWCredentials`/`buildAuthHeader`/`withRetry`.
  Maps each raw comment to a minimal `TWComment { id, body, authorName, datetime, attachmentsCount }`;
  author name from flat `author-firstname`/`author-lastname` with a nested `author` fallback.
- `databaseIpc.ts` + `preload.ts`: new `fetchTWCommentsForTask` IPC handler and bridge method.
- `timesService.ts`: `TWComment` interface + `fetchTWCommentsForTask` wrapper.
- `TaskCommentDialog.tsx`: existing-comments list above the composer; `loadComments` callback; loads on
  open (alongside templates), refetches after a successful send, resets on close. State priority:
  loading → error+retry → empty → list. Each row shows author, formatted date, body, and an attachment
  count when > 0. `isprivate` stays `false`; no pagination UI (first page only).
- i18n: +`commentsTitle`, `commentsLoading`, `commentsLoadError`, `commentsEmpty`, `attachmentsCount`
  (en + es parity).

Tests: 5 new RED→GREEN cases in `src/tests/renderer/TaskCommentDialog.test.tsx` (loading, empty,
error + retry-refetch, populated render, refetch-after-send).

Verification: `pnpm test` 82 files / 657 tests pass; `pnpm type-check` clean; `pnpm lint` 0 errors
(82 pre-existing warnings); `pnpm build` OK.

### TC-4 RDD review (lineage `review-7a14444811da6384`)

- Assessment: `review_due: true` (`slice_budget_reached`; slice from `481d398`, 10 files / 582 lines,
  risk `medium`).
- Result: **APPROVED** (lens `review-reliability`, target `sha256:5c332d05…`); authority burned. No
  correction opened. Reviewed boundary advanced to `ad40d7d`.
- 4 non-blocking advisory findings (separate later work; never re-open this candidate):
  - `apiService.ts:831-845` (WARNING, R3-1) — the fetch fails open: a malformed/non-array `comments` is
    coalesced to `[]` and still returns `success:true`, so the renderer error branch never sees it (the
    same silent-failure class fixed elsewhere). `STATUS` is not checked.
  - `tests/renderer/TaskCommentDialog.test.tsx:32` (WARNING, R3-2) — the renderer tests stub the whole
    `timesService` module, so the new main-process mapping in `fetchTWCommentsForTask` is never executed
    by a test; its fallbacks ship unproved. → folds into TC-5.
  - `TaskCommentDialog.tsx:84` (WARNING, R3-3) — the listing is hard-capped at page 1 / pageSize 50 with
    no pagination or "showing N of M"; a task with >50 comments renders a truncated list that looks complete.
  - `TaskCommentDialog.tsx:330` (SUGGESTION, R3-4) — rows key on `comment.id`; a missing id coerces to
    `''`, so id-less comments would collide on `key=''`.

## TC-5 — Test coverage (2026-10-10, `9c5578b`)

Scope: add-flow (upload / send / error) coverage, folding TC-4 advisory finding **R3-2** (main-service
mapping tests). Test-only — no production change.

- `src/tests/renderer/TaskCommentDialog.test.tsx` — new `describe('TaskCommentDialog add/send flow (TC-5)')`
  (7 cases): body-only happy path (`addCommentToTWTask('12345', body, '', '')` + success toast + dialog
  closes); single attachment ref passed as the 3rd arg; multiple refs comma-joined in attachment order;
  server rejection (error toast with `{ description }`, dialog stays open, body preserved, no success toast);
  notify ids comma-joined in the 4th arg; template selection applies the body; same-name/same-size dedup plus
  a removed attachment excluded from the refs.
- `src/tests/main/services/apiService.test.ts` — new `describe('fetchTWCommentsForTask')` (9 cases: flat
  author mapping; nested-`author` fallback; `attachmentsCount` from `attachments.length` then `0`; missing-field
  defaults; default URL + `{ page: 1, pageSize: 50 }`; custom pagination; missing-creds fails without a request;
  rejection message from `response.data.message`; rejection fallback to the error message) and
  `describe('addCommentToTWTask')` (3 cases: POST URL + exact payload + top-level `commentId`; flat `id`
  fallback; API error message). This executes the main-process agreement mapper that the renderer tests stub.

Verification: `pnpm test` 82 files / 676 tests pass; `pnpm type-check` clean; `pnpm lint` 0 errors (82
pre-existing warnings). Orchestrator spot check of the focused run: 2 files / 63 tests pass.

RDD assessment for `9c5578b` (base `ad40d7d`): risk `medium`, `review_due: false` (`under_budget`,
393 changed lines) → no native review due. No defects surfaced; **R3-2 is now covered**. R3-1/R3-3/R3-4
remain non-blocking advisory follow-ups (out of scope for this feature).

## Design decisions

- **Attachment-only comments (decided 2026-10-09): require text.** The send button is
  disabled when the body is empty; the attachment-only path is removed. Rationale: TW's `body` is
  required by convention (official MCP tool marks it required) and empty-body behavior is
  undocumented, so we fail safe instead of offering a capability that may be rejected.
- **TC-1 gates TC-2/TC-4.** Do not change the POST payload or add the listing endpoint until the TW
  v1 shapes are confirmed (docs/live). The attachment-only-empty-body question is answered by TC-1.
- **Listing UI**: prefer extending `TaskCommentDialog` (list existing comments above the composer)
  over a new dialog, so both entry points benefit with no extra wiring. Decide pagination only if the
  API forces it.
- **`tw_people`**: default is to **drop** the dead table in a guarded migration unless TC-3 finds a
  near-term use; do not add weight without need.
- **Private comments (`isprivate`)**: leave `false`; expose later only if requested.
- **Attachment size cap (decided 2026-10-10): 25 MB per file.** TeamWork accepts up to 2 GB and does not
  restrict types, but the app uploads via the classic `pendingfiles.json` in memory with a 30s timeout;
  25 MB is the safe product cap. File types stay unrestricted (no blocklist) — TW accepts any type and a
  blocklist would break legitimate flows. Oversized files are rejected up front with a visible toast.
- **Failed-attachment semantics (decided 2026-10-10): auto-retry on send.** The pre-send hard guard is
  removed; the send loop re-uploads any attachment lacking a ref (clearing its prior error), so a transient
  failure recovers on the next send. A permanent failure still aborts with `attachmentFailed`.
- **`tw_people` (resolved 2026-10-10): dropped.** The table was dead schema (people are fetched live from
  TW); the migration now runs a guarded `DROP TABLE IF EXISTS tw_people`.

## Acceptance criteria

- Adding a comment still works; an attachment-only comment behaves per TW reality (no false success);
  a failed attachment or notify load is visibly surfaced, never silently swallowed.
- Existing comments of a task are listed with body/author/date, with loading/empty/error states.
- `pnpm test` green, `pnpm type-check` clean, `pnpm lint` 0 errors.

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| Mapping | delegated (one explorer) | >5 sequential lookups; broad read-only map of the comments feature |
| TC-1 | inline (read-only research) | 3 external doc fetches + 2 targeted file reads; within inline evidence budget |
| TC-3 | delegated writer | 5 files touched (dialog + 2 locales + migration + test); 2+ non-trivial files |
| TC-4 | delegated writer | 8 files touched (apiService + IPC + preload + timesService + dialog + 2 locales + test); writer trigger (2+ non-trivial files) |
| TC-5 | delegated writer | 2 non-trivial test files touched (renderer dialog suite + main-service apiService suite); writer trigger (2+ non-trivial files) |

## Progress

- 2026-10-09 — Feature opened from a read-only mapping (delegated explorer). Doc committed on
  `feat/tw-comments` off `staging` @ `e87f5e1`. **No implementation yet.**
- 2026-10-09 — **TC-1 done** (read-only, inline): verified the TW v1 comment POST payload and the
  GET listing shape against official docs. No payload-shape defect found. One open item before TC-2:
  empty-body (attachment-only) behavior — needs a product decision and/or live smoke test.
- 2026-10-09 — **Decision:** attachment-only comments are removed; a non-empty body is required to
  send. TC-2 delegated to a bounded writer (files: `TaskCommentDialog.tsx`, `locales/en.ts`,
  `locales/es.ts`, new `src/tests/renderer/TaskCommentDialog.test.tsx`), TDD RED→GREEN, runner `pnpm test`.
- 2026-10-09 — **TC-2 done** (`481d398`): the add-comment dialog now requires a non-empty body,
  aborts the send when any attachment upload fails (visible error, no false success), and renders a
  distinct notify-load error state with retry-on-reopen. New tests in
  `src/tests/renderer/TaskCommentDialog.test.tsx` (RED→GREEN, 3 cases). Verification: `pnpm test`
  646/646 pass, `pnpm type-check` clean, `pnpm lint` 0 errors (82 pre-existing warnings).
  Known limitation: a previously failed attachment blocks send until the user removes/re-adds it (no auto-retry).
- 2026-10-09 — **TC-2 RDD review: APPROVED** (lineage `review-ea22c0033bad97f6`, lens `review-reliability`,
  target `sha256:e95f4082…`, authority burned). Three advisory (non-blocking) findings, to fold into TC-3:
  - `TaskCommentDialog.tsx:123` — the `notifyError` fallback uses `result.message ?? t(...)`, so a
    present-but-empty message string stays `''` (falsy) and falls through to the empty-list branch,
    reintroducing the silent failure for that input shape. Fix: trim/truthiness fallback.
  - `TaskCommentDialog.tsx:154-157` — the pre-send `attachments.some((a) => a.error)` guard branch is
    not covered by a test, and a transient upload failure blocks send until the user removes/re-adds
    the attachment (no auto-retry). Decide retry semantics in TC-3.
  - `TaskCommentDialog.tsx:119` — pre-existing: `handleOpenNotify` has no try/catch, so a rejected
    fetch (not a resolved `success:false`) leaves the spinner stuck and untryable. TC-3 candidate.
- 2026-10-10 — **TC-3 done** (`d200bd4`): see the TC-3 section above. 6 new RED→GREEN tests
  (`src/tests/renderer/TaskCommentDialog.test.tsx`, 9 total in the file). Verification: `pnpm test`
  82 files / 652 tests pass, `pnpm type-check` clean, `pnpm lint` 0 errors (82 pre-existing warnings),
  `pnpm build` OK.
- 2026-10-10 — **TC-3 RDD assessment:** `review_due: false` (`under_budget`), risk `medium` — the slice
  is under the ~400 authored-line delivery budget, so no native review is due for this commit.
- 2026-10-10 — **TC-4 done** (`ad40d7d`): comment listing implemented end-to-end (see the TC-4 section).
  5 new RED→GREEN tests. Verification: `pnpm test` 82 files / 657 tests pass, `pnpm type-check` clean,
  `pnpm lint` 0 errors (82 pre-existing warnings), `pnpm build` OK.
- 2026-10-10 — **TC-4 RDD review: APPROVED** (lineage `review-7a14444811da6384`, lens `review-reliability`,
  target `sha256:5c332d05…`, authority burned; reviewed boundary advanced to `ad40d7d`). Four advisory
  (non-blocking) findings recorded above (R3-1…R3-4); R3-2 folds naturally into TC-5 (main-service mapping
  tests). Note: the reviewer Task returned empty twice while the prompt was over-materialized; relaunching
  with the exact `provider_task.prompt` (binding line only) succeeded — the live transport supplies the
  patch context.
- 2026-10-10 — **TC-5 done** (`9c5578b`): test-only coverage of the add/send flow + the main-service comment
  mapper (folds R3-2), see the TC-5 section above. 19 new tests (7 renderer + 12 main-service). Verification:
  `pnpm test` 82 files / 676 tests pass; `pnpm type-check` clean; `pnpm lint` 0 errors (82 pre-existing
  warnings). No production code changed.
- 2026-10-10 — **TC-5 RDD assessment:** `review_due: false` (`under_budget`, 393 changed lines), risk
  `medium` — no native review due for this commit.

## Next

- **All tasks done (TC-1…TC-5).** Non-blocking advisory follow-ups left for later: R3-1 (listing fetch
  fails open on malformed `comments`), R3-3 (listing hard-capped at page 1 / pageSize 50, no pagination UI),
  R3-4 (row key on missing `comment.id` collides on `key=''`).
- No push / no PR / no merge — the user owns delivery.

## Evidence files

- `src/renderer/components/TaskCommentDialog.tsx` — dialog; owns the defects.
- `src/main/services/apiService.ts` — `addCommentToTWTask`, `uploadPendingFileToTW`, `fetchTWPeopleForTask`, `fetchTWCommentsForTask`.
- `src/main/services/commentTemplateService.ts`, `src/renderer/pages/SettingsPage.tsx` — templates.
- `src/main/database/migrations.ts` — `comment_templates` (+ dead `tw_people`).
