# Release `v1.14.0` — promote `staging` to `main`

## Objective

Cut `v1.14.0` from `main`, carrying the UX work merged into `staging` since `v1.13.0` — **UX Fases 0–5**
(IA, menús, design system, layout, flujos y accesibilidad WCAG 2.2 AA) — together with the post-1.13.0
follow-ups (CI lockfile gate, README refresh, relaunch E2E record), plus the version bump, CHANGELOG entry
and pre-publish verification the tag-driven release workflow expects.

## Problem

`main` sits at the `v1.13.0` era plus three post-release commits that `staging` does not have
(`.gitignore` for npm `package-lock.json`, PR #22, and the PR #21 merge of `staging`). `origin/main`
(`a67119d`) is **not** a strict ancestor of `origin/staging` (`8d05c41`), so this promotion needs a merge
of `main` into the release branch first (the 1.13.0 promotion was a pure fast-forward; this one is not).

Every merged change since `v1.13.0` lives only on `staging`:

| PR | Track | Document |
|---|---|---|
| #20 | Post-1.13.0 follow-ups (CI lockfile gate, README refresh) | `odd/tasks/post-1.13.0-followups.md` |
| #23 | UX roadmap | `docs/UX-ROADMAP.md` |
| #24 | UX Fase 1 — menús | `odd/tasks/ux-fase-1-menus.md` |
| #25 | UX Fase 2 — design system | `odd/tasks/ux-fase-2-design-system.md` |
| #26 | UX Fase 3 — layout y ventana | `odd/tasks/ux-fase-3-layout.md` |
| #27 | UX Fase 0 — arquitectura de información | `odd/tasks/ux-fase-0-ia.md` |
| #28/#29/#37/#38 | UX Fase 4 — flujos, feedback y estados | `odd/tasks/ux-fase-4-flows.md` |
| #39/#40–#43 | UX Fase 5 — accesibilidad WCAG 2.2 AA | `odd/tasks/ux-fase-5-a11y.md` |

Change set `v1.13.0..staging`: **70 commits, 96 files, +8099/−1474**.

## Version rationale

MINOR bump `1.13.0 → 1.14.0`: additive UX and accessibility features with no BREAKING change. No new
dependencies (`package.json` unchanged vs `v1.13.0`), no SQLite schema migration (`src/main/database/migrations`
untouched), and main-process changes are limited to `src/main/index.ts`, `src/main/menu.ts`,
`src/main/ipc/windowIpc.ts` and `src/main/preload.ts`.

## Scope

- Promote `origin/staging` onto `main`, absorbing `main`'s three post-1.13.0 commits.
- Bump `package.json` `1.13.0` → `1.14.0`.
- Add the `[1.14.0]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.14.0` (triggers publish).

## Out of scope

- UX Fase 6 (i18n y limpieza de copy) and the Reportes backlog (Fase 7) — next track.
- Any source/behavior change beyond the version bump.

## Stale branch cleanup (this release)

The branch `docs/ux-roadmap` (local + remote) held one commit never merged, `088ffd3 docs(ux): record phase 0
product decisions`. Its net diff vs `staging` **regresses** `docs/UX-ROADMAP.md` (reverts `Estado general`
to "Pendiente", unchecks every UX task, deletes the Fase 7 backlog, reasserts older decisions). Its content
is already recorded in `staging`. It was **not** merged; the branch was deleted.

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~150 (CHANGELOG + README + version + this doc).
Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.14.0` from `origin/staging` + this document; delete stale `docs/ux-roadmap` | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.14.0]` CHANGELOG entry, add README release note | `package.json`, `CHANGELOG.md`, `README.md` | delegated (one writer) | [x] — +32/−1 |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (one worker) | [x] — all green (see evidence) |
| R-4 | Commit `chore(release): 1.14.0` | — | direct inline | [x] — `62672aa` |
| R-5 | Promote to `main` + tag `v1.14.0` | — | direct | [x] — main/staging FF to `1a698c2`; tag `v1.14.0` |
| R-6 | Publish the tag and verify the release | `.github/workflows/release.yml` (run) | direct | [x] — run `37254867537` green |

## Acceptance criteria

- `package.json` reports `1.14.0`.
- The `[1.14.0]` CHANGELOG entry is accurate for `v1.13.0..v1.14.0` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build` are green.
- The release commit is a descendant of `origin/main`.

## Verification evidence

Independent verification on `release/1.14.0` (HEAD `8d05c41` + release files), Windows, Node `v22.17.0`,
pnpm `10.28.2`:

- `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date` (49.9s).
- `pnpm type-check` → exit 0, clean.
- `pnpm lint` → exit 0, `83 problems (0 errors, 83 warnings)`, all warning-only (pre-existing `@eslint-react`
  advisories).
- `pnpm test` → exit 0, **71 files / 493 tests passed** (up from 285 at `v1.13.0`).
- `pnpm build` → exit 0, renderer `2448 modules` → `dist-vite/index-BTFUAwFA.js` (413.93 kB │ gzip 131.00 kB),
  main `dist-electron/index.js` (551.69 kB │ gzip 153.36 kB), preload 7.51 kB.

Non-failing warnings observed (pre-existing, out of scope): Vite `configLoader: 'native'` ESM/CJS warning,
`INEFFECTIVE_DYNAMIC_IMPORT` in `apiService.ts`, and a `PLUGIN_TIMINGS` notice.

## Release outcome

- `main` fast-forwarded `a67119d..1a698c2` (after merging `origin/main` into the release branch); `staging`
  fast-forwarded `8d05c41..1a698c2`; annotated tag `v1.14.0` pushed at `1a698c2`. Publish run
  [37254867537](https://github.com/Draifor/tw-time-register/actions/runs/37254867537) — **green on the
  first attempt**, `Pre-create the GitHub release` held and the R4 asset gate passed.
- **Verified final state:** exactly **1** release for `v1.14.0` (not draft, not prerelease); 3 assets —
  `latest.yml` (364 B), `TW-Time-Register-Setup-1.14.0.exe` (126,309,484 B),
  `TW-Time-Register-Setup-1.14.0.exe.blockmap` (133,620 B); `latest.yml` reports `version: 1.14.0`.

## Progress

- 2026-10-04 — Track opened. `origin/staging` (`8d05c41`) verified; `origin/main` (`a67119d`) is not an
  ancestor of `staging` (3 main-only commits: PR #22 `.gitignore`, PR #21 merge). Branch `release/1.14.0`
  created from `origin/staging`. Stale branch `docs/ux-roadmap` deleted (local + remote).
- 2026-10-04 — **R-2 done** (one writer): `package.json` → `1.14.0`, `[1.14.0]` CHANGELOG entry (Added: UX
  Fases 0–5 + CI gate; Changed: README refresh + coverage 285→493; Fixed: relaunch E2E record), README
  `v1.14.0` section. Diff `+32/−1` across the three files. **R-3 done** (same worker): all five gates green
  (frozen install, type-check, 493/493 tests, build) — see *Verification evidence*.
- 2026-10-04 — **R-4 done:** `62672aa` `chore(release): 1.14.0` (4 files, +142/−1, includes this doc).
  RDD assessment (`--base-ref origin/staging --committed-only --json`): **medium**
  (`configuration_change: package.json`), `review_due: false` — `under_budget` (4 paths, 143 lines). No
  native review required for this work unit.
- 2026-10-05 — **R-5/R-6 done:** merged `origin/main` into `release/1.14.0` (`1a698c2`) to absorb the
  main-only post-1.13.0 commits; `main` FF `a67119d..1a698c2`, `staging` FF `8d05c41..1a698c2`; tag
  `v1.14.0` pushed. Publish run `37254867537` green on the first attempt; release verified (1 release,
  3 assets, `latest.yml` `1.14.0`).
