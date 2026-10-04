# Release `v1.13.0` — promote `staging` to `main`

## Objective

Cut `v1.13.0` from `main`, carrying the six PRs merged into `staging` since `v1.12.0` (Performance
Fases 3–6 + Update UX + release pre-create hardening) together with the R-7 publish-race fix that is
already on `main` but untagged, plus the version bump, CHANGELOG entry and pre-publish verification the
tag-driven release workflow expects.

## Problem

`main` sits at `v1.12.0` (`704f069`) plus the R-7 release fix (`0f49a57`, `8025e6d`). Every merged change
since `v1.12.0` lives only on `staging`:

| PR | Track | Document |
|---|---|---|
| #14 | Performance Fase 3 | `odd/tasks/performance-fase-3.md` |
| #15 | Release pre-create hardening | `odd/tasks/release-precreate-hardening.md` |
| #16 | Performance Fase 4 | `odd/tasks/performance-fase-4.md` |
| #17 | Performance Fase 5 | `odd/tasks/performance-fase-5.md` |
| #18 | Performance Fase 6 | `odd/tasks/performance-fase-6.md` |
| #19 | Update UX | `odd/tasks/update-ux.md` |

`origin/main` (`8025e6d`) is an ancestor of `origin/staging` (`41bf2a1`), so the promotion is a
fast-forward. Tagging from `main` today would publish the `1.12.0` content again.

## Version rationale

MINOR bump `1.12.0 → 1.13.0`: additive feature and performance work with no BREAKING change — no SQLite
schema migration (the pending-update marker is a JSON file in `userData`), IPC changes are additive
(`get-update-result`), and the installer keeps `oneClick: false` plus the install-directory picker.

## Scope

- Promote `origin/staging` to `main` (fast-forward).
- Bump `package.json` `1.12.0` → `1.13.0`.
- Add the `[1.13.0]` CHANGELOG entry and the README release note.
- Pre-publish verification.
- Tag `v1.13.0` (human decision; triggers publish).

## Out of scope

- README `🏗️ Stack Tecnológico` / test-count refresh (stale claims at `README.md:26-54`, `:116`, `:164`).
- Packaged end-to-end verification of the assisted-installer relaunch (open README v1.13.0 item).
- Any source/behavior change.

## Delivery strategy

`single-pr` (release chore). Authored changed lines forecast: ~140 (CHANGELOG + README + version + this
doc). Under the ~400-line delivery budget, so one work unit.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R-1 | Create `release/1.13.0` from `origin/staging` and this document | this document | direct inline | [x] |
| R-2 | Bump version, write `[1.13.0]` CHANGELOG entry, refresh README | `package.json`, `CHANGELOG.md`, `README.md` | delegated (one writer) | [x] — 3 files, +25/−2 |
| R-2b | Sync `pnpm-lock.yaml` for `@tanstack/react-virtual` (release blocker surfaced by R-3) | `pnpm-lock.yaml` | direct inline | [x] — +20 lines |
| R-3 | Pre-publish verification: frozen install, type-check, lint, tests, build | — | delegated (verify) | [x] — all green after R-2b (see evidence) |
| R-4 | Commit `chore(release): 1.13.0` | — | direct inline | [x] — `f87cdd4` + `ea6b51e` |
| R-5 | Promote to `main` + tag `v1.13.0` | — | direct (user-approved) | [ ] |
| R-6 | Publish the tag and verify the release | `.github/workflows/release.yml` (run) | direct | [ ] |

## Acceptance criteria

- `package.json` reports `1.13.0`.
- The `[1.13.0]` CHANGELOG entry is accurate for `v1.12.0..v1.13.0` and follows Keep a Changelog.
- `pnpm install --frozen-lockfile` (no lockfile diff), `type-check`, `lint`, `vitest`, `pnpm build` are green.
- The release commit is a descendant of `origin/main` (fast-forwardable).

## Verification evidence

Independent read-only verification on `release/1.13.0` (HEAD `41bf2a1` + the release files), Windows,
Node `v22.17.0`, pnpm `10.28.2`:

- `pnpm type-check` → exit 0, clean.
- `pnpm lint` → exit 0, `82 problems (0 errors, 82 warnings)`, all warning-only.
- `pnpm test` → exit 0, Vitest `5.0.3`, **39 files / 285 tests passed** (confirms the 203 → 285 claim).
- `pnpm build` → exit 0, renderer to `dist-vite/` (2443 modules), main + preload to `dist-electron/`.
- `pnpm install --frozen-lockfile` → **first run FAILED**: `ERR_PNPM_OUTDATED_LOCKFILE`
  (`@tanstack/react-virtual@^3.14.13` was in `package.json` but missing from `pnpm-lock.yaml`). A
  pre-existing defect from `8bc9928` (PERF-301); the lockfile had not been touched since `93bbc9f`. It
  would have failed the tag-push workflow, which runs `pnpm install --frozen-lockfile`.
- **Fix (R-2b, direct inline):** `pnpm install` synced the lockfile (`+20` lines: `@tanstack/react-virtual`
  and `@tanstack/virtual-core`). Re-check `pnpm install --frozen-lockfile` → exit 0, `Lockfile is up to date`.

Non-failing warnings observed (pre-existing, out of scope): Vite `configLoader: 'native'` ESM/CJS warning,
an `INEFFECTIVE_DYNAMIC_IMPORT` in `apiService.ts`, and a `PLUGIN_TIMINGS` notice.

## Release outcome

_To be filled by R-6._

## Progress

- 2026-10-03 — Track opened. `origin/main` (`8025e6d`) verified as an ancestor of `origin/staging`
  (`41bf2a1`); branch `release/1.13.0` created from `origin/staging`. Change set `main..staging`:
  64 files, +4779/−597.
- 2026-10-03 — **R-2 done** (one writer): `package.json` → `1.13.0`, `[1.13.0]` CHANGELOG entry (Added:
  Update UX; Changed: Performance Fases 3–6 + coverage 203→285; Fixed: NSIS relaunch + R-7 publish race),
  README v1.13.0 section marked `PUBLICADA` with the four Fase 3–6 bullets. Diff `+25/−2` across the three
  files; the stale `Stack Tecnológico` / test-count lines were left untouched (out of scope).
- 2026-10-03 — **R-3 done** (one verify worker): the four code gates green (type-check, lint, 285/285 tests,
  build), but `pnpm install --frozen-lockfile` failed on a pre-existing lockfile omission
  (`@tanstack/react-virtual`, from PERF-301). **R-2b** synced the lockfile (direct inline, `+20` lines) and
  the frozen install re-check is green (see *Verification evidence*).
- 2026-10-03 — **R-4 done:** `f87cdd4` `build(deps): sync the lockfile for @tanstack/react-virtual` and
  `ea6b51e` `chore(release): 1.13.0`. RDD assessment (`--base-ref origin/staging --committed-only` after
  excluding the untracked `package-lock.json`): **medium** (`configuration_change: package.json`),
  `review_due: false` — `under_budget` (5 paths, 153 lines). No native review required for this work unit.
