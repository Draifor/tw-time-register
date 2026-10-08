# Release `v1.16.0` — promote `staging` to `main`

## Objective

Cut `v1.16.0` from `main`, carrying the UX work merged into `staging` since `v1.15.0` — **UX Fase 7**
(Reportes, UX-701..UX-703) plus **UX Table & Scroll Consistency** — together with the version bump,
CHANGELOG entry and pre-publish verification the tag-driven release workflow expects.

## Problem

`origin/main` (`a4e2ce0`, v1.15.0) **is** an ancestor of `origin/staging` (`cf6eb10`), so this promotion is
a clean fast-forward.

Change set `v1.15.0..staging`: **27 files, +2685/−534**, 17 commits (incl. the two PR merge commits).

| PR | Track | Document |
|---|---|---|
| #51 | UX Fase 7 — Reportes (UX-701..UX-703) | `odd/tasks/ux-fase-7-reports.md` |
| #52 | UX Table & Scroll Consistency | `odd/tasks/ux-table-consistency.md` |

## Version rationale

MINOR bump `1.15.0 → 1.16.0`: additive UX features (Reports presets/sent-local/weekly view + unified table
scroll model) with no BREAKING change. No new dependencies (`package.json`/`pnpm-lock.yaml` unchanged vs
`v1.15.0`), no SQLite schema migration (`src/main/database/migrations` untouched), and no `src/main/**`
source change. The changeset is confined to `src/renderer/**`, locales, renderer tests and docs.

## Scope

- Promote `origin/staging` onto `main` (fast-forward).
- Bump `package.json` `1.15.0` → `1.16.0`.
- Add the `[1.16.0]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.16.0` (triggers publish).

## Out of scope

- Removing the now-unused `@tanstack/react-virtual` dependency — follow-up.
- Any source/behavior change beyond the version bump.

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~170 (CHANGELOG + README + version + this
doc). Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.16.0` from `origin/staging` + this document | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.16.0]` CHANGELOG entry, add README release note | `package.json`, `CHANGELOG.md`, `README.md` | direct inline | [x] |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (one verifier) | [x] — all green (see evidence) |
| R-4 | Commit `chore(release): 1.16.0` | — | direct inline | [ ] |
| R-5 | Promote to `main` + `staging` (FF) + tag `v1.16.0` | — | direct | [ ] |
| R-6 | Publish the tag and verify the release | `.github/workflows/release.yml` (run) | direct | [ ] |

## Acceptance criteria

- `package.json` reports `1.16.0`.
- The `[1.16.0]` CHANGELOG entry is accurate for `v1.15.0..v1.16.0` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build` are green.
- The release commit is a descendant of `origin/main`.

## Verification evidence

Independent verification on `release/1.16.0` (working tree = `origin/staging` + release files), Windows,
Node `v22.x`, pnpm `10.28.2` — **VERDICT: PASS**:

- `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date, resolution step is skipped`. No
  lockfile diff (`pnpm-lock.yaml` unmodified).
- `pnpm type-check` → exit 0, clean (no diagnostics).
- `pnpm lint` → exit 0, `✖ 82 problems (0 errors, 82 warnings)` (baseline; all pre-existing `@eslint-react`
  advisories).
- `pnpm test` → exit 0, **80 files / 624 tests passed** (up from 74 files / 563 tests at `v1.15.0`).
- `pnpm build` → exit 0: renderer `dist-vite/assets/index-DFux4UMe.js` (413.47 kB │ gzip 130.83 kB),
  `index-CWV6ht-6.css` (62.21 kB │ gzip 10.93 kB); main `dist-electron/index.js` (551.69 kB │ gzip
  153.36 kB); preload `dist-electron/preload.js` (7.51 kB │ gzip 1.97 kB).

Non-failing warnings observed (pre-existing, out of scope): Vite `configLoader: 'native'` ESM/CJS warning
and `INEFFECTIVE_DYNAMIC_IMPORT` in `apiService.ts`.

## Release outcome

_Pending (R-6)._

## Progress

- 2026-10-08 — Track opened. `origin/main` (`a4e2ce0`) verified as an ancestor of `origin/staging`
  (`cf6eb10`) → FF promotion. `release/1.16.0` created from `origin/staging`.
- 2026-10-08 — **PR #52 merged into `staging`** (`cf6eb10`); post-merge topology check passed
  (`feat/ux-table-consistency` tip `202878a` is an ancestor of `origin/staging`; `staging..feature` empty).
- 2026-10-08 — **R-1/R-2 done:** `release/1.16.0` created; `package.json` → `1.16.0`; `[1.16.0]` CHANGELOG
  entry (Added: Fase 7 + table consistency; Fixed: History scroll; Changed: coverage 563→624); README
  `v1.16.0` section.
- 2026-10-08 — **R-3 done** (one verifier): all five gates green — VERDICT PASS (see *Verification
  evidence*).
