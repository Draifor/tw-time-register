# Release `v1.12.0` — promote `staging` to `main`

## Objective

Cut `v1.12.0` from `main`, carrying the seven PRs merged into `staging` since `v1.11.0` (toolchain
modernization + Performance Fase 2), with the version bump, CHANGELOG entry and pre-publish verification
that the tag-driven release workflow expects.

## Problem

`main` sits at `v1.11.0` plus docs. Every merged change since then lives only on `staging`:

| PR | Track | Document |
|---|---|---|
| #7 | Tailwind 4 | `odd/tasks/tailwind-4.md` |
| #8 | Vitest 5 | `odd/tasks/vitest-5.md` |
| #9 | Vite 8 (Rolldown) | `odd/tasks/vite-8.md` |
| #10 | TypeScript 7 (side-by-side) | `odd/tasks/typescript-7.md` |
| #11 | ESLint 10 | `odd/tasks/eslint-10.md` |
| #12 | React Compiler (measured no-go) | `odd/tasks/react-compiler.md` |
| #13 | Performance Fase 2 | `odd/tasks/performance-fase-2.md` |

Tagging from `main` today would publish the `1.11.0` content again. `origin/main` is an ancestor of
`origin/staging`, so the promotion is a fast-forward.

## Why now, not after Fase 3

- Tailwind 4 rewrites the whole visual layer; an installed-build checkpoint isolates its blast radius
  before Fases 3–6 (tables, sync, startup) are layered on top.
- The batch is a coherent unit: "stack modernization + Performance Fase 2".
- It exercises the R4 duplicate-release gate (`scripts/verify-release-assets.ps1`) in a real publish for
  the first time since the `v1.11.0` incident.

## Scope

- Promote `origin/staging` to `main` (fast-forward).
- Bump `package.json` `1.11.0` → `1.12.0`.
- Add the `[1.12.0]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.12.0` (human decision; triggers publish).

## Out of scope

- Performance Fases 3–6, and any source/behavior change.

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~120 (CHANGELOG + README + version + this
doc). Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.12.0` from `origin/staging` and this document | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.12.0]` CHANGELOG entry, refresh README | `package.json`, `CHANGELOG.md`, `README.md` | delegated (one writer) | [x] — 3 files, +29/−1 |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (verify) | [x] — all green (see evidence) |
| R-4 | Commit `chore(release): 1.12.0` | — | direct inline | [ ] |
| R-5 | Promote to `main` + tag `v1.12.0` | — | human decision | [ ] |

## Acceptance criteria

- `package.json` reports `1.12.0`.
- The `[1.12.0]` CHANGELOG entry is accurate for `v1.11.0..v1.12.0` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build` are green.
- The release commit is a descendant of `origin/main` (fast-forwardable).

## Verification evidence

Independent read-only verification on `release/1.12.0` (HEAD `05fa506` + the release-prep files), Node
`v22.17.0`, pnpm `10.28.2`. Every command exited 0:

- `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date, resolution step is skipped`.
- `git status --porcelain pnpm-lock.yaml` → **empty** (no lockfile drift).
- `pnpm type-check` → exit 0, clean.
- `pnpm lint` → exit 0, `82 problems (0 errors, 82 warnings)`, all `@eslint-react/*` (warning-only pass).
- `pnpm test` → exit 0, Vitest `5.0.3`, **26 files / 203 tests passed** (confirms the 196 → 203 claim).
- `pnpm build` → exit 0, Vite `8.3.2`, renderer + electron main + preload built.
- `./build-local.ps1` → exit 0; `[afterPack]` packaged-native probe passed
  (`{"ok":true,"roundtrip":42,"electron":"44.4.5","abi":"149"}`).

Non-failing warnings observed (pre-existing, out of scope): Vite `configLoader: 'native'` ESM/CJS warning,
a >500 kB chunk, and an `INEFFECTIVE_DYNAMIC_IMPORT` in `apiService.ts`.

## Progress

- 2026-10-03 — Track opened. `origin/main` (`91d10d6`) verified as an ancestor of `origin/staging`
  (`05fa506`), so the promotion is a fast-forward. Branch `release/1.12.0` created from `origin/staging`.
- 2026-10-03 — **R-2 done** (one writer): `package.json` → `1.12.0`, `[1.12.0]` CHANGELOG entry, README
  roadmap section. Range `v1.11.0..HEAD` = 38 non-merge commits, 62 files, +4928/−4201.
- 2026-10-03 — **R-3 done** (one verify worker): all Tier 1 commands and the packaged `afterPack` probe
  green (see *Verification evidence*).
- 2026-10-03 — Follow-up noted, out of scope: the README `🏗️ Stack Tecnológico` and test-count lines are
  stale versus the 1.12.0 stack (Electron 44, React 19, Vite 8, Tailwind 4, Vitest 5). Not changed here.
