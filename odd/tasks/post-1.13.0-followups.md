# Post-`v1.13.0` follow-ups — README refresh, CI lockfile gate, relaunch E2E

## Objective

Close the three follow-ups left after the `v1.13.0` release:

1. **M1 — README refresh:** the `🏗️ Stack Tecnológico` section and the test-count lines still describe the
   pre-1.12.0 stack (Electron 30, React 18, Vite 7, Tailwind 3.4, Vitest 4, 111/108 tests).
2. **M2 — CI lockfile gate:** add a PR workflow that runs `pnpm install --frozen-lockfile` so a dependency
   added without a lockfile update fails on the pull request, not in the release workflow.
3. **M3 — relaunch E2E:** verify the assisted-installer relaunch fix end to end on a packaged build
   (the open `V6` item in `odd/tasks/update-ux.md`).

## Problem

- `README.md` is factually stale versus `package.json` (see *M1 detail*).
- There is **no PR CI at all** — `.github/workflows/` only contains `release.yml` (tag-triggered). Nothing
  validates the lockfile before merge. This is exactly why the missing `@tanstack/react-virtual` entry
  (PERF-301) reached the `v1.13.0` release workflow and had to be fixed mid-release
  (see `odd/tasks/release-1.13.0.md`).
- The NSIS relaunch fix is covered by unit tests and a successful installer compile (`V5`), but the real
  behavior — a packaged client updating and reopening itself — is still unverified (`V6`).

## M1 detail (stale README lines)

| Line | Current | Correct |
|---|---|---|
| 26 | Electron v30 | Electron v44 |
| 27 | React v18 + TypeScript v5 | React v19 + TypeScript v7 (CLI; TS 6 API) |
| 28 | Vite v7 | Vite v8 (Rolldown) |
| 33 | Tailwind CSS v3.4 | Tailwind CSS v4 |
| 45 | better-sqlite3 v11 | better-sqlite3 v13 |
| 53 | ESLint v9 + typescript-eslint v8 | ESLint v10 + @eslint-react |
| 54 | Vitest v4 — 111 tests | Vitest v5 — 285 tests |
| 116 | Vitest — 111 tests, 8 suites | Vitest — 285 tests, 39 files |
| 164 | 108 tests | 285 tests |

Out of scope here: `.github/copilot-instructions.md:355,488` (same stale counts) — noted, not changed.

## M2 detail (CI gate)

New `.github/workflows/ci.yml`: on `pull_request` (+ `workflow_dispatch`), set up Node 22 + pnpm 10 and run
`pnpm install --frozen-lockfile`. Scope is deliberately just the lockfile gate, per request; type-check /
lint / test / build can be added later.

## M3 detail (relaunch E2E) — VERIFIED (2026-10-04)

**Outcome:** the user updated a real packaged client to `1.13.0` from an earlier version, waited without
acting, and the app **relaunched by itself after a few seconds**. That is exactly the assisted-installer
relaunch the NSIS fix targets, observed end to end on a real build — `V6` in `odd/tasks/update-ux.md` is now
**PASS**, so no newer release or VM was needed.

Original analysis of why a *newer* target would otherwise have been required (retained for context):

The E2E needs an update **target newer than the installed version**. Current facts (2026-10-04):

- The user's machine already has **`1.13.0` installed and running** (`%LOCALAPPDATA%\Programs\TW Time Register`,
  exe `FileVersion 1.13.0`, timestamp = the release build).
- `v1.13.0` is the latest published release, so there is nothing newer to update to.
- The base NSIS template already relaunches on a silent forced update
  (`app-builder-lib/templates/nsis/installSection.nsh:104-110`: `if isForceRun AND Silent → doStartApp`),
  and the custom `build/installer.nsh` adds the finish-page path plus the `--updated` launch flag.

Therefore the E2E requires one of:
- **(a)** publish a newer patch (e.g. `v1.13.1`, which could carry M1+M2) and let the installed `1.13.0`
  client update to it — the user watches whether it reopens by itself; or
- **(b)** a disposable test environment (VM or a second machine) where installing an older build is safe.

Doing it on the live install would downgrade/overwrite the user's running app — not acceptable without an
explicit decision.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| M1 | Refresh stale README stack/test lines | `README.md` | delegated (one writer) | [x] — `118ffd2` |
| M2 | Add CI lockfile gate | `.github/workflows/ci.yml` (new) | delegated (same writer) | [x] — `3e7e96f` |
| M3 | Relaunch E2E verification | `odd/tasks/update-ux.md` | manual (user-observed) | [x] — PASS, 2026-10-04 |

## Acceptance criteria

- README stack/test values match `package.json` and the suite (`285` tests).
- `ci.yml` is valid YAML, runs `pnpm install --frozen-lockfile`, and triggers on `pull_request`.
- M3 is either executed and recorded in `odd/tasks/update-ux.md` (V6), or explicitly deferred with its
  blocker recorded.

## Progress

- 2026-10-04 — Track opened on `chore/post-1.13.0-followups` from `origin/staging` (`4f48c3e`). M3 blocked:
  the live install is already `1.13.0` and no newer release exists.
- 2026-10-04 — **M1 done** (`118ffd2`): 9 stale README lines corrected (Electron 30→44, React 18→19,
  TS 5→7, Vite 7→8, Tailwind 3.4→4, better-sqlite3 11→13, ESLint 9→10 + @eslint-react, Vitest 4→5,
  111/108→285 tests). **M2 done** (`3e7e96f`): `.github/workflows/ci.yml` runs
  `pnpm install --frozen-lockfile --ignore-scripts` on `pull_request`; YAML parse-validated with `js-yaml`.
- 2026-10-04 — Native review could not close: after consent (`granted`) and transaction creation
  (lineage `review-309715685d6c8833`, 4 lenses), `review.status` returned `operation_timeout` /
  `manual_action_required` twice (120 s and 300 s) — the known Gentle AI defect
  [#4655](https://github.com/Gentleman-Programming/gentle-ai/issues/4655) (open, no published fix). The
  review locks were orphaned, not held. **Per the user's decision, M1 + M2 are delivered under ordinary
  policy without review closure.** M3 remains pending its own decision (needs a version newer than `1.13.0`
  or a disposable VM).
- 2026-10-04 — **M3 done (user-observed):** on the real `1.13.0` update the user waited without acting and
  the packaged app relaunched by itself after a few seconds. `V6` in `odd/tasks/update-ux.md` is now PASS;
  no newer release or VM was needed. All three follow-ups are closed.
