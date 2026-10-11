# Release `v1.17.0` — promote `staging` to `main`

## Objective

Cut `v1.17.0` from `main`, carrying the features and fixes merged into `staging` since `v1.16.1` —
the **TW task comment listing** feature (read/list existing comments, with hardening of the
add-comment flow), its **follow-up hardening**, and the **partial time registration** feature
(register the valid leading prefix when trailing rows are still in progress) — together with the
version bump, CHANGELOG entry, README release note and the pre-publish verification the
tag-driven release workflow expects.

## Problem

`origin/main` (`e87f5e1`, the `v1.16.1` outcome record) **is** an ancestor of `origin/staging`
(`7e44e7e`, the merge of PR #57), so this promotion is a clean fast-forward.

Change set `v1.16.1..staging`: **17 files, +2709/−76**, 22 commits (incl. three PR merge commits).

| PR | Track | Document |
|---|---|---|
| #55 | TW comments: listing + add-flow hardening | `odd/tasks/tw-comments.md` |
| #56 | TW comments follow-up (TC-6 advisories) | `odd/tasks/tw-comments-followup.md` |
| #57 | Partial time registration (valid prefix) | `odd/tasks/partial-time-registration.md` |

## Version rationale

MINOR bump `1.16.1 → 1.17.0`: **new user-facing features** (comment listing; partial registration),
plus bug fixes and hardening, no BREAKING change. No new dependencies
(`package.json`/`pnpm-lock.yaml` unchanged vs `v1.16.1`). One SQLite migration is present
(`src/main/database/migrations.ts`: idempotent `DROP TABLE IF EXISTS tw_people`, dead schema).

## Scope

- Promote `origin/staging` onto `main` (fast-forward).
- Bump `package.json` `1.16.1` → `1.17.0`.
- Add the `[1.17.0]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.17.0` (triggers publish).

## Out of scope

- Any new behavior change: this is a promotion of already-reviewed `staging` content.
- The residual non-blocking advisories already recorded in the feature docs (accepted follow-ups).

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~200 (CHANGELOG + README + version +
this doc). Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.17.0` from `origin/staging` + this document | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.17.0]` CHANGELOG entry, add README release note | `package.json`, `CHANGELOG.md`, `README.md` | direct inline | [x] |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (one verifier) | [x] — all green (see evidence) |
| R-4 | Commit `chore(release): 1.17.0` | — | direct inline | [ ] |
| R-5 | Promote to `main` + `staging` (FF) + tag `v1.17.0` | — | direct | [x] — main `e87f5e1..70124c6`; staging `7e44e7e..70124c6`; tag `v1.17.0` |
| R-6 | Publish the tag and verify the release | `.github/workflows/release.yml` (run) | direct | [x] — run `38145755420` green; asset gate passed |

## Acceptance criteria

- `package.json` reports `1.17.0`.
- The `[1.17.0]` CHANGELOG entry is accurate for `v1.16.1..v1.17.0` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build`
  are green.
- The release commit is a descendant of `origin/main`.

## Verification evidence

Independent verification on `release/1.17.0` (working tree = `origin/staging` @ `7e44e7e` + release
files), Windows, pnpm — **VERDICT: PASS** (one delegated verifier):

- `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date, resolution step is skipped`.
  `pnpm-lock.yaml` SHA256 identical before/after (no lockfile diff).
- `pnpm type-check` → exit 0, clean (no diagnostics).
- `pnpm lint` → exit 0, `✖ 83 problems (0 errors, 83 warnings)` (baseline `@eslint-react` advisories).
- `pnpm test` → exit 0, **83 files / 696 tests passed** (up from 81 files / 643 at `v1.16.1`).
  No failed, no skipped, no flaky reproductions.
- `pnpm build` → exit 0: `dist-electron/index.js` 554.52 kB (gzip 154.13), `dist-electron/preload.js`
  7.60 kB, `dist-vite/assets/index-BUeWr9uP.js` 414.18 kB (gzip 131.08).

Post-run `git status --porcelain` unchanged vs baseline (only the four expected release files).

## Release outcome

- `main` fast-forwarded `e87f5e1..70124c6`; `staging` fast-forwarded `7e44e7e..70124c6`; annotated
  tag `v1.17.0` pushed at `70124c6`. Publish run
  [38145755420](https://github.com/Draifor/tw-time-register/actions/runs/38145755420) — **green**;
  the `Pre-create the GitHub release` and the `Verify release assets` steps both passed.
- **Verified final state:** exactly **1** release for `v1.17.0` (not draft, not prerelease);
  3 assets — `latest.yml` (364 B), `TW-Time-Register-Setup-1.17.0.exe` (126,307,015 B),
  `TW-Time-Register-Setup-1.17.0.exe.blockmap` (133,593 B); `latest.yml` reports `version: 1.17.0`.

## Progress

- 2026-10-11 — Track opened. PR #57 verified **MERGED** into `staging` (merge commit `7e44e7e`).
  `origin/main` (`e87f5e1`) verified as an ancestor of `origin/staging` (`7e44e7e`) → FF promotion.
  `release/1.17.0` created from `origin/staging`. R-1 done.
- 2026-10-11 — **R-2 done:** `package.json` → `1.17.0`, `[1.17.0]` CHANGELOG entry, README release
  note.
- 2026-10-11 — **R-3 done** (one delegated verifier): all five gates green — VERDICT PASS (see
  *Verification evidence*).
- 2026-10-11 — **R-4 done:** `6e73271` `chore(release): 1.17.0` (4 files, +127/−1, includes this
  doc). RDD assessment (`review mode status`: `on`; `assess --base-ref origin/staging
  --committed-only --json`): **medium** (`configuration_change: package.json`), `review_due: false`
  — `under_budget` (4 paths, 128 lines). No native review required for this work unit.
- 2026-10-11 — **R-5/R-6 done:** `release/1.17.0` pushed; `main` FF `e87f5e1..70124c6`, `staging` FF
  `7e44e7e..70124c6`; tag `v1.17.0` pushed. Publish run `38145755420` green; release verified
  (1 release, 3 assets, `latest.yml` `1.17.0`).
