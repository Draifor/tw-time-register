# Release `v1.16.1` — promote `staging` to `main`

## Objective

Cut `v1.16.1` from `main`, carrying the fixes merged into `staging` since `v1.16.0` — the
**TW sync integrity** fix (no more duplicate time entries), the **dev/prod userData isolation**
fix and the **History delete-dialog overflow** fix — together with the version bump, CHANGELOG
entry and the pre-publish verification the tag-driven release workflow expects.

## Problem

`origin/main` (`ba69416`, v1.16.0) **is** an ancestor of `origin/staging` (`4d78b19`), so this
promotion is a clean fast-forward.

Change set `v1.16.0..staging`: **9 files, +748/−11**, 11 commits (incl. two PR merge commits).

| PR | Track | Document |
|---|---|---|
| #53 | Dev/prod userData isolation | `odd/tasks/tw-sync-integrity.md` (follow-up note) |
| #54 | TW sync integrity (no duplicates) | `odd/tasks/tw-sync-integrity.md` |

## Version rationale

PATCH bump `1.16.0 → 1.16.1`: bug fixes only, no new features and no BREAKING change. No new
dependencies (`package.json`/`pnpm-lock.yaml` unchanged vs `v1.16.0`), no SQLite schema migration
(`src/main/database/migrations` untouched).

## Scope

- Promote `origin/staging` onto `main` (fast-forward).
- Bump `package.json` `1.16.0` → `1.16.1`.
- Add the `[1.16.1]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.16.1` (triggers publish).

## Out of scope

- The residual `R3-AMBIG` advisory (ambiguous day+duration match on legacy unlinked entries after
  a description edit) — accepted follow-up, recorded in `odd/tasks/tw-sync-integrity.md`.
- Bulk repair of legacy NULL-id rows and cleanup of duplicates already created in TW.

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~180 (CHANGELOG + README + version +
this doc). Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.16.1` from `origin/staging` + this document | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.16.1]` CHANGELOG entry, add README release note | `package.json`, `CHANGELOG.md`, `README.md` | direct inline | [x] |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (one verifier) | [x] — all green (see evidence) |
| R-4 | Commit `chore(release): 1.16.1` | — | direct inline | [x] — `987b530` |
| R-5 | Promote to `main` + `staging` (FF) + tag `v1.16.1` | — | direct | [ ] |
| R-6 | Publish the tag and verify the release | `.github/workflows/release.yml` (run) | direct | [ ] |

## Acceptance criteria

- `package.json` reports `1.16.1`.
- The `[1.16.1]` CHANGELOG entry is accurate for `v1.16.0..v1.16.1` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build`
  are green.
- The release commit is a descendant of `origin/main`.

## Verification evidence

Independent verification on `release/1.16.1` (working tree = `origin/staging` + release files),
Windows, pnpm — **VERDICT: PASS**:

- `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date, resolution step is skipped`.
  No lockfile diff (`pnpm-lock.yaml` unmodified).
- `pnpm type-check` → exit 0, clean (no diagnostics).
- `pnpm lint` → exit 0, `✖ 82 problems (0 errors, 82 warnings)` (baseline `@eslint-react` advisories).
- `pnpm test` → exit 0, **81 files / 643 tests passed** (up from 80 files / 624 at `v1.16.0`). The
  known flaky `appRouting.test.tsx` case did not reproduce.
- `pnpm build` → exit 0: `dist-electron/index.js` 553.42 kB (gzip 153.81), `dist-electron/preload.js`
  7.51 kB, `dist-vite/assets/index-wiPPiWkP.js` 413.47 kB (gzip 130.83).

## Release outcome

_(to be filled after publish)_

## Progress

- 2026-10-09 — Track opened. `origin/main` (`ba69416`) verified as an ancestor of `origin/staging`
  (`4d78b19`) → FF promotion. PR #54 merged into `staging`; post-merge topology check passed
  (`fix/tw-sync-integrity` tip `9d2db02` is an ancestor of `origin/staging`). `release/1.16.1`
  created from `origin/staging`. R-1/R-2 done.
- 2026-10-09 — **R-3 done** (one verifier): all five gates green — VERDICT PASS (see *Verification
  evidence*).
- 2026-10-09 — **R-4 done:** `987b530` `chore(release): 1.16.1` (4 files, +104/−1, includes this
  doc). RDD assessment (`review mode status`: `on`; `assess --base-ref origin/staging
  --committed-only --json`): **medium** (`configuration_change: package.json`), `review_due: false`
  — `under_budget` (4 paths, 105 lines). No native review required for this work unit.
