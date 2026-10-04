# Performance Fase 5 — Startup y bundle

- **Feature id:** performance-fase-5
- **Roadmap:** `docs/PERFORMANCE-ROADMAP.md` §Fase 5 (PERF-501..505)
- **Branch:** `feat/performance-fase-5` (off `origin/staging` @ `dafd4e2`)
- **Delivery strategy:** `single-pr` into `staging` (3 work-unit commits, well under ~400 authored lines)
- **Status:** Implemented and verified — delivery and native review pending

## Objective

Reduce the renderer's initial chunk and the main-process time-to-first-paint:
code-split routes, load locales on demand, show the window with a dark
background before migrations finish, and clean up build/startup hygiene.

## Problem

- `src/renderer/App.tsx` statically imports every page, so WorkTimeForm,
  flatpickr, date-fns and both i18n locales all land in the initial chunk.
- `src/main/index.ts` awaits `runMigrations()` before `createWindow()`, so
  nothing paints until migrations finish; the window also uses `show: true`
  without a `backgroundColor` (white flash).
- Both i18n locales are statically bundled; `date-fns/locale` is imported as a
  barrel.
- Minor hygiene: placeholder `<title>`, `console.log` in production migration
  paths, cwd-relative top-level `rmSync` in `vite.config.ts`.

## Why

Continue the performance track after Fase 4 (sync/red). Startup/bundle was the
next recommended phase and the app's audit (2026-09-23) flagged a ~702 KB
single renderer chunk.

## Scope

In scope: PERF-501, PERF-502, PERF-503, PERF-504, PERF-505.
Out of scope: Fase 6 items, replacing SQLite with a worker, removing date-fns
entirely (evaluate only).

## Authorized edit surfaces

- `src/renderer/App.tsx`
- `src/renderer/main.tsx`
- `src/renderer/plugins/i18n.ts`
- `src/renderer/locales/index.ts` (removed)
- `src/renderer/components/TotalTimeDay.tsx`
- `src/renderer/components/SelectLanguage.tsx`
- `src/renderer/pages/SettingsPage.tsx`
- `src/renderer/index.html`
- `src/main/index.ts`
- `src/main/database/database.ts`
- `src/main/database/migrations.ts`
- `src/main/database/dbReadiness.ts` (new)
- `vite.config.ts`
- `package.json`
- `src/tests/**` (new/updated tests)
- `docs/PERFORMANCE-ROADMAP.md`

## Tasks

- [x] **P5-01 · PERF-501 — Code splitting by route**
  - `React.lazy` + `<Suspense>` for `WorkTimeForm`, `TasksPage`, `HomePage`,
    `ReportsPage`, `SettingsPage` in `App.tsx`; `AppBar`/`NavBar`/`Toaster` kept
    eager.
  - Vendor grouping intentionally NOT added: the Rolldown `advancedChunks` API
    was not confirmed from the Vite 8 skill, so no classic `manualChunks` was
    faked; lazy route chunks alone delivered the win.
  - Acceptance met: initial chunk no longer contains WorkTimeForm/flatpickr/
    date-fns; build emits no >500 KB warning.

- [x] **P5-02 · PERF-502 — Migrations after window show + IPC readiness gate**
  - New pure `src/main/database/dbReadiness.ts`: `armDbReadiness()`,
    `markDbReady()`, `whenDbReady()`, plus `resetDbReadinessForTests()`. Default
    state resolved (test-safe).
  - `database.ts`: exported raw opener `openDbRaw`; default `openDb()` awaits
    `whenDbReady()` then delegates to raw. `migrations.ts` uses `openDbRaw`
    (avoids deadlock).
  - `index.ts`: `armDbReadiness()` → `createWindow()` → `await runMigrations()`
    → `markDbReady()`; failure path keeps `showErrorBox` + `app.quit()` and does
    not mark ready.
  - Acceptance met: no IPC handler touches the DB before migrations complete;
    disarmed gate resolves immediately (real-SQLite harness passes).

- [x] **P5-03 · PERF-503 — Window paint without white flash**
  - `show: false`, `backgroundColor: '#282c34'`, `once('ready-to-show', () =>
    window.show())`; `nativeTheme.themeSource = 'dark'` moved before
    `new BrowserWindow`.
  - Acceptance met.

- [x] **P5-04 · PERF-504 — i18n and date libs**
  - Only the fallback language (`en`, also asserted by `i18nRouter.test.tsx`) is
    bundled; `es` is lazy-`import()`ed via `loadLanguage()` +
    `addResourceBundle`, called from `SelectLanguage` and `SettingsPage` before
    `changeLanguage`.
  - `TotalTimeDay.tsx` deep-imports `date-fns/locale/en-US` and
    `date-fns/locale/es`.
  - Acceptance met: `es` is a separate lazy chunk; the i18n regression test
    stays green; Spanish still translates.

- [x] **P5-05 · PERF-505 — Build/config hygiene**
  - `index.html`: real `<title>TW Time Register</title>`.
  - `migrations.ts`: migration `console.log` gated behind `!app.isPackaged`.
  - `vite.config.ts`: top-level cleanup now root-relative
    (`join(root, 'dist-electron')`).
  - `package.json` / `src/main/tsconfig.json`: investigated, **no change** — the
    `dev:electron`/`build:electron` path is genuinely stale/broken
    (`tsc` emits `dist-electron/main/index.js` while `main` is
    `dist-electron/index.js`), but nothing in CI uses it and a fix is ambiguous.
    Left as a follow-up per the prior user decision recorded in
    `odd/tasks/tailwind-4.md`.

## Test-first policy

Default policy applied where a runnable deterministic test exists:

- **P5-02:** `dbReadiness` unit test — RED (module missing) → GREEN (4 tests).
- **P5-04:** `i18nLazy` test — RED (`loadLanguage` missing; `es` eagerly
  bundled) → GREEN (2 tests, idempotency triangulated).
- **P5-01/503/505:** no meaningful runnable RED; verified structurally (build
  chunk listing, built `<title>`, gated-log grep). Documented exception.

## Verification

```pwsh
npm run test
npm run type-check
npm run lint
npm run build
```

## Verification evidence

- `npm run test`: **33 files, 256 tests passed** (includes the real-SQLite
  integration harness and the new `dbReadiness` / `i18nLazy` tests).
- `npm run type-check`: exit 0, no diagnostics.
- `npm run lint`: exit 0; 0 errors, 82 pre-existing warnings (none on changed
  lines).
- `npm run build`: exit 0. Renderer initial chunk **464.47 kB** (audited baseline
  ~702 KB); `es` locale chunk 18.31 kB and `WorkTimeForm` chunk 62.72 kB are
  lazy-only. No >500 KB warning. `dist-vite/index.html` carries
  `<title>TW Time Register</title>`.
- Structural exclusion: grep of the eager set loaded by `dist-vite/index.html`
  found 0 flatpickr / date-fns-locale internals.

## Work-unit commits

1. `c317af9` — `perf(renderer)`: lazy routes + lazy `es` locale + date-fns deep
   imports (PERF-501, PERF-504).
2. `2a40341` — `perf(main)`: window-first startup with an IPC readiness gate
   (PERF-502, PERF-503).
3. `82af06e` — `chore(build)`: real title, prod-only migration logs,
   root-relative dist cleanup (PERF-505).
4. (this commit) — `docs(odd)`: record the Fase 5 track and mark the roadmap.

## Follow-ups (not in this phase)

- `dev:electron` / `build:electron` are stale and broken (see P5-05 item 4).
- Roadmap rows for PERF-102 / PERF-104 and the "deps in dependencies" part of
  PERF-505 are already implemented in code; they are stale in the roadmap.

## Delivery

Single PR into `staging` (branch `feat/performance-fase-5`). PR creation and
merge are user-owned.

## Review outcome

- Native review `review-37d014d03f77c5a1` (medium risk, single lens
  `review-reliability`) against target `sha256:c9513a00…` (tree `92529ce`):
  **approved** and acknowledged; authority **burned**.
- Non-blocking advisory findings (they do NOT reopen this candidate — treat as
  separate later work):
  - `R3-lazy-routes-no-error-boundary` (WARNING, `src/renderer/App.tsx:38-50`):
    the lazy route subtree has no error boundary; a rejected chunk import would
    blank the renderer instead of showing a fallback.
  - `R3-loadlanguage-failure-unhandled` (WARNING,
    `src/renderer/plugins/i18n.ts:24-31`): `loadLanguage()`'s dynamic import has
    no try/catch, so a rejected `es` chunk aborts the language switch silently.
  - `R3-migrations-deadlock-path-untested` (WARNING,
    `src/main/database/migrations.ts:11-13`): no test proves migrations use the
    un-gated opener; a regression to the gated default would deadlock startup
    while tests stay green.
  - `R3-readiness-gate-no-timeout` (SUGGESTION, `src/main/index.ts:128-131`):
    the readiness gate has no timeout; a hung migration would leave every
    DB-touching IPC handler pending.
- Proactive follow-up: the reviewer Task only completes when the agent prompt is
  the exact `provider_task.prompt` (the binding line) — appending material
  caused `opencode_task_output_empty` / `opencode_reviewer_result_refused`.
