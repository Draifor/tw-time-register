# Release `v1.15.0` — promote `staging` to `main`

## Objective

Cut `v1.15.0` from `main`, carrying the UX work merged into `staging` since `v1.14.0` — **UX Fase 6**
(i18n y limpieza de copy, UX-601..UX-604) — plus the version bump, CHANGELOG entry and pre-publish
verification the tag-driven release workflow expects.

## Problem

`origin/main` (`1a698c2`, v1.14.0 era) **is** an ancestor of `origin/staging` (`1044083`), so this
promotion is a clean fast-forward (unlike v1.14.0, which required merging `main` into the release branch).
The Fase 6 chain first landed on `staging` via PR #44 (tracker merge), but the child commits did not reach
`staging` because of the recurring chain-topology bug; that was repaired by the recovery PR **#50**
(`fix/ux-fase-6-recovery`, merge commit `1044083`). All Fase 6 content is now on `staging`.

Change set `v1.14.0..staging`: **29 files, +1072/−495**, 17 commits.

| PR | Track | Document |
|---|---|---|
| #44, #50 | UX Fase 6 — i18n y limpieza de copy (UX-601..UX-604) | `odd/tasks/ux-fase-6-i18n-cleanup.md` |

## Version rationale

MINOR bump `1.14.0 → 1.15.0`: additive i18n, copy and dead-code cleanup with no BREAKING change. No new
dependencies (`package.json`/`pnpm-lock.yaml` unchanged vs `v1.14.0`), no SQLite schema migration
(`src/main/database/migrations` untouched), and the changeset is confined to `src/renderer/**`, locales,
renderer tests and docs (no `src/main/**` source changes).

## Scope

- Promote `origin/staging` onto `main` (fast-forward).
- Bump `package.json` `1.14.0` → `1.15.0`.
- Add the `[1.15.0]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.15.0` (triggers publish).

## Out of scope

- UX Fase 7 (Reportes: UX-701 presets, UX-702 enviadas vs locales, UX-703 vista semanal) — next track.
- Any source/behavior change beyond the version bump.

## Stale branch cleanup (this release)

The Fase 6 branches were deleted after verifying their content is contained in `staging` (local branches
were exact ancestors; the four remote child-branch tips held only the old broken-topology merge commits,
with no content unique beyond what the recovery already brought into `staging`):

- Local: `feat/ux-fase-6-01-dead-code`, `-02-i18n-strings`, `-03-locales`, `-04-action-copy`, `-05-closure`,
  `feat/ux-fase-6-i18n-cleanup`, `fix/ux-fase-6-recovery`.
- Remote: the same seven branches on `origin`.

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~150 (CHANGELOG + README + version + this
doc). Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.15.0` from `origin/staging` + this document; delete stale Fase 6 branches | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.15.0]` CHANGELOG entry, add README release note | `package.json`, `CHANGELOG.md`, `README.md` | direct inline | [x] |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (one verifier) | [x] — all green (see evidence) |
| R-4 | Commit `chore(release): 1.15.0` | — | direct inline | [x] — `4721181` |
| R-5 | Promote to `main` + `staging` (FF) + tag `v1.15.0` | — | direct | [x] — main `1a698c2..a4e2ce0`; staging `1044083..a4e2ce0`; tag `v1.15.0` |
| R-6 | Publish the tag and verify the release | `.github/workflows/release.yml` (run) | direct | [x] — run `37531266283` green; R4 asset gate passed |

## Acceptance criteria

- `package.json` reports `1.15.0`.
- The `[1.15.0]` CHANGELOG entry is accurate for `v1.14.0..v1.15.0` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build` are green.
- The release commit is a descendant of `origin/main`.

## Verification evidence

Independent verification on `release/1.15.0` (working tree = `origin/staging` + release files), Windows,
Node `v22.x`, pnpm `10.28.2`:

- `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date, resolution step is skipped` (4.8s).
  No lockfile diff.
- `pnpm type-check` → exit 0, clean (no diagnostics).
- `pnpm lint` → exit 0, `✖ 83 problems (0 errors, 83 warnings)` (baseline; all pre-existing `@eslint-react`
  advisories).
- `pnpm test` → exit 0, **74 files / 563 tests passed** (up from 493 tests at `v1.14.0`). The known
  `timeLogsTableVirtual.test.tsx` parallel-load flake did not reproduce.
- `pnpm build` → exit 0: renderer `dist-vite/assets/index-CNpJIJfv.js` (414.47 kB │ gzip 131.09 kB), main
  `dist-electron/index.js` (551.69 kB │ gzip 153.36 kB), preload `dist-electron/preload.js` (7.51 kB).

Non-failing warnings observed (pre-existing, out of scope): Vite `configLoader: 'native'` ESM/CJS warning,
`INEFFECTIVE_DYNAMIC_IMPORT` in `apiService.ts`, and a `PLUGIN_TIMINGS` notice.

## Release outcome

- `main` fast-forwarded `1a698c2..a4e2ce0`; `staging` fast-forwarded `1044083..a4e2ce0`; annotated tag
  `v1.15.0` pushed at `a4e2ce0`. Publish run
  [37531266283](https://github.com/Draifor/tw-time-register/actions/runs/37531266283) — **green on the
  first attempt**; the `Pre-create the GitHub release` step held and the R4 asset gate passed.
- **Verified final state:** exactly **1** release for `v1.15.0` (not draft, not prerelease); 3 assets —
  `latest.yml` (364 B), `TW-Time-Register-Setup-1.15.0.exe` (126,309,285 B),
  `TW-Time-Register-Setup-1.15.0.exe.blockmap` (133,676 B); `latest.yml` reports `version: 1.15.0`.

## Progress

- 2026-10-06 — Track opened. `origin/main` (`1a698c2`) verified as an ancestor of `origin/staging`
  (`1044083`) → FF promotion. Fase 6 branches deleted (7 local + 7 remote). `release/1.15.0` created from
  `origin/staging`.
- 2026-10-06 — **R-2 done:** `package.json` → `1.15.0`; `[1.15.0]` CHANGELOG entry (Changed: UX Fase 6
  i18n/copy + coverage 493→563; Removed: UX-603 dead code); README `v1.15.0` section. **R-3 done** (one
  verifier): all five gates green — see *Verification evidence*.
- 2026-10-06 — **R-4 done:** `4721181` `chore(release): 1.15.0` (4 files, +125/−1, includes this doc).
  RDD assessment (`--base-ref origin/staging --committed-only --json`): **medium**
  (`configuration_change: package.json`), `review_due: false` — `under_budget` (4 paths, 126 lines). No
  native review required for this work unit.
- 2026-10-06 — **R-5/R-6 done:** `release/1.15.0` pushed; `main` FF `1a698c2..a4e2ce0`, `staging` FF
  `1044083..a4e2ce0`; tag `v1.15.0` pushed. Publish run `37531266283` green on the first attempt; release
  verified (1 release, 3 assets, `latest.yml` `1.15.0`).
