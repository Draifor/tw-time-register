# Vitest 5 — Track F of the stack upgrade

## Objective

Move the test runner to **Vitest 5** (`vitest` 5.0.3, with `@vitest/coverage-v8` and `@vitest/ui` on the
same version) — without losing any of the **196 passing tests** Track B closed on, and without touching
application code.

## Problem

The repo is on **Vitest 4.0.18** (declared `^4.0.18`) while **5.0.3** is current. Track F is named in the
stack-upgrade plan as the runner track, "part of the gate; move last so the gate is stable while the app
changes" (`odd/tasks/react-19.md:85`). It needs its own feature document, exactly as Tracks A and B did.

This is that document.

## Why now, and why before Track C

1. **The original "move last" reason expired.** It existed to keep the gate stable while the *app* changed
   (Tracks A and B). Those are done; what remains are toolchain tracks. The app is no longer moving.
2. **Track F blocks Track C.** `vitest@4.0.18` declares `vite: ^6.0.0 || ^7.0.0`, so Vite 8 cannot be
   installed alongside it. `vitest@5` advertises `vite: ^6.4.0 || ^7.0.0 || ^8.0.0`, so **F lands on the
   current Vite 7 and unblocks C** (measured inventory `odd/tasks/react-19.md` Track C note; Engram
   `odd/vite-8/inventory`). This is the sequencing decision recorded as pending after Track B merged:
   Vitest 5 first, then Vite 8.
3. **It is the lowest-uncertainty remaining track.** Vitest is a dev-only tool: nothing it does reaches the
   shipped app. The failure mode is red tests, not a broken product, so machine gates are the whole
   instrument — unlike Track B, which needed a human visual smoke test.

## The gap (measured 2026-10-03)

| Package | Have (installed) | Latest | Nature | Risk |
|---|---|---|---|---|
| `vitest` | `4.0.18` | **5.0.3** | major | medium |
| `@vitest/coverage-v8` | `4.0.18` | **5.0.3** | major, version-locked to vitest | low |
| `@vitest/ui` | `4.0.18` | **5.0.3** | major, version-locked to vitest | low |
| Node | `22.17.0` | — | satisfies `^22.12.0 \|\| ^24 \|\| >=26` | low |
| Vite | `7.2.6` | — | satisfies the new `^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` peer | low |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **F can land on the current Vite 7, and does not force C.** `vitest@5.0.3` peers `vite: ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0` and `engines.node: ^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0`. Installed `vite` 7.2.6 and `node` v22.17.0 both satisfy. | `pnpm view vitest@5.0.3 peerDependencies engines`; `node -v`; `package.json:100` |
| E2 | **The three packages are version-locked and must move together.** `vitest@5.0.3` declares exact peers `@vitest/ui: 5.0.3` and `@vitest/coverage-v8: 5.0.3`. All three are declared `^4.0.18` today. Target: `^5.0.3` on all three. | `pnpm view vitest@5.0.3 peerDependencies`; `package.json:83,84,103`; `pnpm view @vitest/coverage-v8 dist-tags` / `@vitest/ui dist-tags` → `latest: 5.0.3` |
| E3 | **The test surface is small and modern — most v5 breaking changes are no-ops here.** 21 test files (15 main-process / 6 renderer). **No** snapshots (`.snap`, `__snapshots__`, `toMatchSnapshot`, `toMatchInlineSnapshot`), **no** browser mode, **no** `test.projects`/workspace, **no** `test.sequential`/`concurrent`, **no** `bench`, **no** `expect.extend`, **no** `test.each`/`test.for`. Entrypoints are only `vitest` and `vitest/config` (none of the deprecated ones v5 removes). | explorer inventory over `src/tests/**`, `vitest.config.ts`; `rg` for each token |
| E4 | **The one real type-level risk: jest-dom is wired through the plain entry.** `src/tests/setup.ts:4` imports `'@testing-library/jest-dom'`, and only `i18nRouter.test.tsx` exercises a jest-dom matcher (`toBeInTheDocument()` ×5, lines 63,64,71,74,91). Vitest 5 **no longer reads custom matcher declarations from the global `jest.Matchers` interface**, so the plain entry's augmentation can stop satisfying `tsc`. The documented fix is the Vitest-specific entry `@testing-library/jest-dom/vitest`. | official migration guide §*Assertion Types*; `src/tests/setup.ts`; `rg 'toBeInTheDocument' src/tests`; `tsconfig.json:20` includes `**/*.ts(x)` so tests are type-checked |
| E5 | **`clearMocks` now defaults to `true` — the behavioural risk to prove by running.** v5 calls `vi.clearAllMocks()` before every test. Blast radius measured: most suites already isolate explicitly (`vi.resetAllMocks()` / `vi.clearAllMocks()` / `mockClear().mockClear()…` in `beforeEach`). The exceptions to watch are suites whose assertions depend on mock history recorded outside the test body, notably `updater.test.ts` (hoisted mocks, no `beforeEach` clear). Only a suite run settles it. | migration guide §*clearMocks*; `rg 'resetAllMocks\|clearAllMocks\|mockClear' src/tests`; `src/tests/main/updater.test.ts:5-25` |
| E6 | **The "hoisted mocking calls must be top-level (now throws)" rule should not fire.** Every `vi.mock`/`vi.hoisted` site is at module top level, not inside a `describe`/`it`/function: `backupService.test.ts:5-13`, `updater.test.ts:5`, `updater.install.test.ts:12`, `apiService.test.ts:5-6`, `encryptionService.test.ts:7`, `settingsService.test.ts:5-14`, `syncService.test.ts:6-16`, `taskService.test.ts:5`, `timeEntriesService.test.ts:5-9`, `useTasksOptimistic.test.tsx:11-22`, `workTimeSave.test.ts:8`. Confirm at run time. | migration guide §*Hoisted Mocking Calls*; `rg 'vi\.mock\(\|vi\.hoisted\(' src/tests` |
| E7 | **Fake timers are unaffected.** v5 fakes `Temporal` alongside `Date`, but `Temporal` is not present natively on Node 22.17 and no polyfill imports it, so there is nothing to fake. The two sites are `vi.useFakeTimers({ toFake: ['Date'] })` (`timeEntriesService.test.ts:338,358` — explicitly Date-only) and `vi.useFakeTimers()` (`updater.install.test.ts:54`). | migration guide §*Fake Timers and setSystemTime Now Mock Temporal*; `rg 'useFakeTimers' src/tests`; Node 22.17 has no global `Temporal` |
| E8 | **The "unawaited async assertions now fail" rule is satisfied.** The three `.rejects` sites are all awaited — `settingsService.test.ts:273`, `taskService.test.ts:153`, `timeEntriesService.test.ts:149`. No `.resolves` and no `toMatchFileSnapshot` exist. | migration guide §*Unawaited Asynchronous Assertions*; `rg '\.rejects\|\.resolves\|toMatchFileSnapshot' src/tests` |
| E9 | **Two more v5 changes are no-ops here, proven by zeros.** No `toThrow('')` (every `toThrow` argument is non-empty: `/NOT VERIFIED/`, `/Missing/`, `'insert failed'`, `'lookup failed'`, and a multi-line message), and no custom `expect.extend`/assertion-type references. | `rg 'toThrow\(' src/tests`; `rg 'expect\.extend' src/tests` |
| E10 | **`coverage` and `ui` are developer-only.** The only CI workflow (`.github/workflows/release.yml`) runs `pnpm install`, `pnpm build` and electron-builder — it never runs `test`, `test:coverage` or `test:ui`. So the coverage `include`/`exclude` matching-precision change and the UI auth change cannot break CI. Coverage `include` patterns already use `**` wildcards (`vitest.config.ts:23`), so the new relative-path matching is expected to keep the same file set. | `rg` over `.github/workflows`; migration guide §*Coverage include and exclude*; `vitest.config.ts:20-24` |
| E11 | **The `vitest --ui` URL now requires a token** (`?token=…` printed by Vitest). This is a developer-experience change to the `test:ui` script (`package.json:38`), not a test failure. | migration guide §*Vitest UI Requires an Authenticated URL* |
| E12 | **v5 centralizes generated artifacts under `.vitest/`**, and `.gitignore` has no `.vitest/` entry. Hygiene only — the default `vitest run` reporter writes nothing there. | migration guide §*Generated Reports and Artifacts*; `.gitignore` |

## Constraints

- **Node stays on 22.** E1 shows 22.17.0 satisfies the new engine range. Do not bump `.node-version` or CI.
- **No version bump, tag, release or publish in this track.** Separate human decisions.
- **196 tests are the regression floor** (the number Track B closed on). The suite must not go down.
- **No application-code changes.** Vitest is a dev-only tool; `src/renderer/**` and `src/main/**` must be
  byte-identical at the end of this track. Only test infrastructure may change if a gate demands it.
- **One track per commit series.** A track that leaves the suite red is not a track; it is a revert.
- **Track-scoped:** no Vite, TypeScript, ESLint or Tailwind version changes (tracks C–E, each with its own
  document).
- Conventional commits, English artifacts, no AI attribution.

## Verification mode

- **TDD: not enabled** — unchanged from Tracks A and B. Ordinary functional verification.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Extra gate for this track:** `pnpm install --frozen-lockfile` must exit 0 (proves the lockfile is
  coherent), and `npm run test:coverage` must exit 0 (proves the v8 provider still loads under v5). No human
  smoke test is required: nothing in this track touches the shipped app.

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `vitest.config.ts`, `src/tests/setup.ts`, `.gitignore`, and this document.

**Not authorized by this track:** any change under `src/renderer/**` or `src/main/**` (application code), any
other track's config or versions, and any version bump, tag or publish.

## Tasks — Track F

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| F1 | **Capture the baseline on the fork point** — `npm test`, `npm run type-check`, `npm run lint`, `npm run build`, `pnpm install --frozen-lockfile` — and record the exact numbers as the regression floor | — | direct inline (one command batch) | [x] — **done 2026-10-03.** Baseline at `2987765`: `npm test` **196/196** across 21 files; `type-check`, `lint`, `build`, `frozen-lockfile` all exit 0. The known Saturday flake (`timeEntriesService.test.ts:339`) **did not reproduce**. Floor fixed at **196**. |
| F2 | **Bump `vitest`, `@vitest/coverage-v8`, `@vitest/ui` to `^5.0.3`** as one step (E2), install, and record the resolved versions and any peer warnings | `package.json`, `pnpm-lock.yaml` | direct inline (a dependency edit; the audit removed the unknowns) | [x] — **done 2026-10-03.** Installed `vitest` / `@vitest/coverage-v8` / `@vitest/ui` **5.0.3** (E2). `pnpm install` exit 0; the only peer warnings are the pre-existing electron-builder/squirrel ones — none from Vitest. |
| F3 | **Fix the v5 fallout, minimally.** Expected: switch `setup.ts` to `@testing-library/jest-dom/vitest` (E4). Conditional: set `clearMocks: false` only if a suite E5 flagged depends on cross-test history; add `.vitest/` to `.gitignore` (E12). No application-code edits | `src/tests/setup.ts`, `src/tests/main/updater.test.ts`, `.gitignore` | direct inline (already-understood edits) | [x] — **done 2026-10-03.** Both predicted REDs reproduced and were fixed **at the test level, not by changing config**: (a) `tsc` `TS2339` on `toBeInTheDocument` ×5 → switched the setup import to `@testing-library/jest-dom/vitest` (E4); (b) `updater.test.ts:55` `checkHandler` undefined → the new `clearMocks` default cleared the hoisted mock history test 2 inherited from test 1 behind `src/main/updater`'s module-level register guard; fixed by loading a fresh module per test (`vi.resetModules()` + dynamic import), matching `updater.install.test.ts`. `clearMocks` was left at its new default. `.vitest/` and `/coverage/` added to `.gitignore` (E12 + the verifier's residue). **Zero app-code edits.** |
| F4 | **Verify:** suite (≥196), `type-check`, `lint`, `build`, `pnpm install --frozen-lockfile`, `npm run test:coverage`; plus a read-only confirmation that `src/renderer/**` and `src/main/**` are untouched | — | per-action workers | [x] — **done 2026-10-03** by a read-only verifier: `npm test` **196/196 (21 files) on `vitest 5.0.3`**; `type-check`, `lint`, `build`, `frozen-lockfile`, `test:coverage` all exit 0. Coverage headline: statements **40.57%**, branches **33.71%**, functions **40.26%**, lines **41.19%**. `git diff 2987765 -- src/renderer src/main` is **empty**. |
| F5 | **Record results, evidence and residue here**, then close the track | this document | direct inline | [x] — **done 2026-10-03.** Evidence recorded in the task rows and Progress; code committed as `6c313e8` (`test: upgrade the test runner to Vitest 5`), this document committed separately. |

## Acceptance criteria

- `vitest`, `@vitest/coverage-v8`, `@vitest/ui` are all on 5.x (E2).
- **At least 196 tests pass**, and `type-check`, `lint`, `build` are clean.
- `pnpm install --frozen-lockfile` exits 0 and `npm run test:coverage` exits 0.
- **Zero authored changes under `src/renderer/**` or `src/main/**`** — a dev-only tool bump must not move the
  product.
- Anything the upgrade cannot fix within this track is recorded as a finding, not quietly left.

## Residue

- **`clearMocks: true` is now the suite default, and no config override was needed.** Every other suite already
  isolates explicitly (`vi.resetAllMocks()` / `vi.clearAllMocks()` in `beforeEach`), so only `updater.test.ts`
  needed a code fix (F3). If a future test depends on mock history recorded outside its body, make that test
  independent — do **not** disable `clearMocks` globally to hide it.
- **`npm run test:ui` now needs the token-authenticated URL Vitest prints** (E11). Developer-experience change
  only; the `test:ui` script is unchanged.
- **Pre-existing build warnings, unrelated to this track and not proven pre-existing by a base diff:** the
  renderer chunk exceeds 500 kB, `src/main/services/apiService.ts` is both statically and dynamically imported,
  and Rollup reports `Unknown input options: platform`. The F1 baseline showed the `platform` warning too;
  recorded so a later track does not mistake them for v5 fallout.
- **No version bump, tag or publish.** Content on `staging` since `v1.10.0` remains unreleased; that stays a
  human decision.

## Review record

- **Approved** 2026-10-03, lineage `review-2feb270891cab86d`, one lens `review-reliability`, tier **medium**,
  candidate `2987765..baee9ef` (6 paths, 583 lines), correction budget 200 — **no correction opened**.
  Acknowledged; authority **burned** (`gentle-ai.review-acknowledged/v1`). Consent was relayed and **granted**
  by the user.
- **Four non-blocking advisory findings** (recorded as follow-ups, never a reason to re-review this candidate):
  - `R3-VITEST5-NOCI` (WARNING, `package.json:103`) — the major bump has no *automated* regression gate: the
    repo's only CI workflow never runs the suite, so the green result is a one-time manual observation.
  - `R3-JESTDOM-ENTRY` (SUGGESTION, `src/tests/setup.ts:6`) — the `/vitest` subpath resolves against an
    unpinned jest-dom major; the compatibility is asserted rather than pinned. (It did resolve: `tsc` and the
    suite pass.)
  - `R3-CARET-DRIFT` (SUGGESTION, `package.json:83-84`) — the version-locked trio uses caret ranges, so a
    non-frozen resolution could mismatch; pre-existing style.
  - `R3-KNOWN-FLAKE` (SUGGESTION, `odd/tasks/vitest-5.md:88`) — the 196 floor coexists with a pre-existing
    date-dependent flake that merely did not reproduce on this run.

## Delivery plan

`delivery_strategy: ask-on-risk` (the repo default). The forecast is well under the ~400 authored-line
heuristic. Measured: commit `6c313e8` is 5 files, **+211 −233**, of which `pnpm-lock.yaml` is **+188 −225**;
the authored change excluding the lockfile is **+23 −8** (`.gitignore` +2, `package.json` +3/−3,
`updater.test.ts` +15/−4, `setup.ts` +3/−1), plus this document. No chained PR is warranted: **one feature
branch (`feat/vitest-5`, off `staging`) and a single PR to `staging`**. Push and PR remain the user's call.

## Progress

- 2026-10-03 — **Track F opened with the measured inventory.** Branch `feat/vitest-5` created off `staging`
  (`2987765`). No dependency has moved yet. The inventory proved the track is small and low-risk: the runner
  surface is 21 modern test files with none of the removed APIs, and most v5 breaking changes are no-ops
  here (E3, E6, E7, E8, E9, E10). The two things to actually watch are the `clearMocks` default flip (E5)
  and the jest-dom type entry (E4). Sequencing is settled: **F before C**, because `vitest@5` accepts Vite 7
  today and `vitest@4` blocks Vite 8 (E1). Next: **F1** (baseline).
- 2026-10-03 — **Track F executed and verified.** F1 baseline 196/196 at `2987765`. F2 moved the three
  version-locked packages to 5.0.3. F3 hit and fixed both predicted REDs at the test level — the
  `@testing-library/jest-dom/vitest` entry (E4) and a fresh `src/main/updater` module per test against the new
  `clearMocks` default (E5) — leaving `clearMocks` at its new default. F4 re-ran the whole gate set green on
  `vitest 5.0.3` (**196/196**, type-check/lint/build/frozen-lockfile/coverage exit 0, app code untouched).
  Committed as `6c313e8`. Next: native review of this candidate under RDD, then the human's push/PR decision.
