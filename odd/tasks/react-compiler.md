# React Compiler — Track G of the stack upgrade

> Organic Driven Development task document. Source of truth for this feature.
> Mirror in Engram: topic key `odd/react-compiler/tasks`.

- **Feature:** `react-compiler`
- **Branch:** `feat/react-compiler` (off `staging` @ `651b986`, the PR #11 merge)
- **Created:** 2026-10-03
- **Status:** **CLOSED** — decision A: measured no-go (2026-10-03). No build change; this document is the record.
- **Source:** `odd/tasks/react-19.md` — the "Track G" row of the track table and the Resume block.

## Objective

Adopt React Compiler 1.0.0 in the renderer build, on **measured** evidence — not on the claim that it
"just works". The compiler bails out silently on code it cannot analyse, so the only way to know what it
does to *this* codebase is to run it and read the diagnostics.

The outcome also settles a real product decision the React 19 track unblocked: whether **performance
Fase 2** (re-render work) should be hand-written memoisation or delegated to the compiler. Doing manual
memo first and adding the compiler later risks writing code the compiler makes redundant — and manual
memo with incomplete dependencies can actively *block* it (`preserve-manual-memoization`).

## Problem

The app's largest component, `WorkTimeForm.tsx`, is **1196 lines** and re-renders **every second** while
the live timer runs. That timer is the concrete cost the original performance roadmap wanted to address.
The stack upgrade (tracks A–F) is merged, React 19 is in, and React Compiler 1.0.0 is now a real release
— so the deferral's own precondition ("upgrade React first, then decide on measurement") is satisfied.

What is *not* known, and cannot be assumed:

- Does the compiler actually compile `WorkTimeForm`, or bail out on it?
- Which functions in the renderer are skipped, and why?
- Does the compiled output keep all 196 tests green, `type-check`, `lint` and `build` clean?
- Which of the two integration paths plugin-react 6 offers is the right one here?
- What does compilation cost at build time and in bundle size?

## Gap (measured 2026-10-03)

| Package | Have | Latest | Nature | Risk |
|---|---|---|---|---|
| `babel-plugin-react-compiler` | — | **1.0.0** | new build step (Babel path) | unknown — needs the spike |
| `@rolldown/plugin-babel` | — | **0.2.4** | peer of the Babel path | low |
| `oxc-transform-react` | — | **0.152.0** | Rust port (alternative path) | **experimental** |
| `@babel/core` | — | **8.0.6** | peer of the Babel path | low |
| `react-compiler-runtime` | — | 1.0.0 | **not needed** — React 19 uses `react/compiler-runtime` | — |
| `eslint-plugin-react-compiler` | — | **19.1.0-rc.2** | lint gate for compiler violations | low |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **`@vitejs/plugin-react@6.1.1` offers two React Compiler integration paths, and the track's opening plan named only one.** Path A (Babel): `reactCompilerPreset()` + `@rolldown/plugin-babel` + `babel-plugin-react-compiler` + `@babel/core` — the documented, stable path. Path B (Rust): `react({ compiler: true })` + `oxc-transform-react` — a native port, explicitly marked **experimental** in the plugin's own README. Both are declared as **optional** peers, so neither is installed today. | `node_modules/@vitejs/plugin-react/package.json` `peerDependencies` + `peerDependenciesMeta`; `README.md` §"React Compiler" (Rust React Compiler / Babel React Compiler) |
| E2 | **React 19 means no runtime package is required.** The compiler emits `react/compiler-runtime`, which React 19 ships. `react-compiler-runtime` is only needed when targeting `'17'`/`'18'` via `reactCompilerPreset({ target })`. | `README.md` (`target` option); `react-compiler-runtime@1.0.0` peer `react: ^17 \|\| ^18 \|\| ^19` |
| E3 | **The current build is Oxc-only; the Babel path would add a second transform pipeline.** `vite-8.md` E3 already recorded plugin-react 6 as usable with no extra package. The Rust path keeps everything in the native pipeline; the Babel path adds a Babel pass over the matched files. This is the real tradeoff to measure, not just "which is newest". | `vite-8.md:49`; `@rolldown/plugin-babel@0.2.4` peer deps |
| E4 | **Two known Rules-of-React hazards already sit in the renderer and are prime bail-out candidates.** `src/renderer/hooks/useTable.tsx:31-65` builds a table column whose `cell` renderer calls `useState`/`useEffect` inside a non-component factory (it already carries three `eslint-disable @eslint-react/rules-of-hooks` comments), and `useSkipper` (`:16-29`) runs a `useEffect` with **no dependency array**. These are exactly the shapes the compiler reports and skips. | `useTable.tsx` source; the existing eslint-disable comments at `:34, :36, :49` |
| E5 | **The compiler compiles only 61% of the renderer's candidate functions and skips the rest.** Babel path over the whole renderer: **80 `CompileSuccess` / 52 `CompileError`** (0 `CompileSkip`) — 132 candidate functions, **52 skipped across 25 files**. It is not a handful of edge cases; it is a large fraction of the app. | spike `rc-spike.ndjson` (logger on `reactCompilerPreset`); `@vitejs/plugin-react@6.1.1` |
| E6 | **48 of the 52 skips are upstream compiler "Todo" limitations, not app bugs.** Reasons: `try/finally` **27**, destructuring-default (`Expected object property value to be an LVal, got: AssignmentPattern`) **18**, `TSNonNullExpression` object key **2**, value blocks inside `try/catch` **1**, optional chaining in a logical test block **1**. The remaining 4 are real: refs-during-render **2**, manual-memo not preservable **1**, incompatible library **1**. | same log; `detail.options.category` = `Todo` 48 / `Refs` 2 / `PreserveManualMemo` 1 / `IncompatibleLibrary` 1 |
| E7 | **`WorkTimeForm` — the flagship and the whole reason for the track — is skipped, and the blockers are layered.** First blocker: `try/finally` in the draft-restore effect (`WorkTimeForm.tsx:229-269`). A behavior-preserving rewrite (nested async, no `finally`) was tried as a **temporary spike edit**: the component **still failed to compile**, on a *different* limitation — `Unexpected terminal kind 'optional' for logical test block` at `WorkTimeForm.tsx:673` (`entry.startTime?.[0]` inside a `||` chain). Fixing one compiler gap just exposes the next. | spike run 1 (before rewrite) vs run 2 (after rewrite); both `CompileError` for the `WorkTimeForm` fn (166→1305) |
| E8 | **The failing functions are the biggest and most complex screens.** Per-file error counts: `SettingsPage.tsx` **9**, `ImportTasksDialog.tsx` 5, `TimeLogsTable.tsx` 5, `PullFromTWDialog.tsx` 4, `useTable.tsx` 3, `HomePage.tsx` 3, `combobox.tsx` 3, then 18 files with 1–2. The compiler covers the small presentational pieces and skips the hard ones. | same log, grouped by filename |
| E9 | **Both integration paths build, and the Rust path is much faster — but neither compiles `WorkTimeForm`.** Babel path: renderer build **9.58 s** (baseline 3.77 s, **+5.81 s**) and bundle **1,007,129 B** (+42,730 B, **+4.43%**). Rust path (`react({ compiler: { logDiagnostics: true } })` + `oxc-transform-react@0.145.0`): renderer build **4.10 s** (+0.33 s) and bundle **1,018,380 B** (+53,981 B, **+5.60%**); it reported the *same* `WorkTimeForm` `try/finally` skip with ~21 diagnostics total (fewer than Babel's 52 — the Rust port does not surface every Todo check). Plugin-react's declared peer is `oxc-transform-react@^0.145.0`; the latest **0.152.0 is outside that range** and produces a peer warning. | build timings + `dist-vite/assets/*.js` sizes, baseline vs both paths |
| E10 | **The test runner does not see the compiler.** `vitest.config.ts` uses only `react()` (its own config, deliberately separate from `vite.config.ts`); so the 196 tests would **not** exercise compiled output unless the compiler preset is added there too. Any adoption must add it to both configs, or the regression floor proves nothing about the shipped bytes. | `vitest.config.ts:10` |
| E11 | **The 4 non-Todo findings were each read in source after the spike — and none is a safe code fix.** `useTable.tsx:18/28` — `useSkipper` reads `shouldSkipRef.current` **during render**: a genuine Rules-of-React violation, but it is the **documented TanStack escape hatch** whose whole point is to avoid an extra render; there is no behaviour-identical refactor, and it only needs changing *if* the compiler is adopted (rejected). `useTable.tsx:98` — TanStack Table `useReactTable()` is **incompatible by design** (it returns unmemoizable functions); unfixable from here. `SettingsPage.tsx:134` — React Hook Form `useForm().watch()` is likewise incompatible; unfixable from here. `input-time.tsx:83` — the `useMemo` on `[optionsKey]` is **intentional and correct**: the comment at `:35-45` explains that keying on `options` identity would rebuild the flatpickr instance every second under the live timer and close open pickers (the Track A regression); the compiler's `PreserveManualMemo` flag is expected, and "fixing" the deps would **reintroduce** that bug. | `useTable.tsx:16-29,98`, `input-time.tsx:35-45,52-83`, `SettingsPage.tsx:134`; spike `Refs`/`IncompatibleLibrary`/`PreserveManualMemo` details |

## Constraints

- **Node stays on 22.17.0** (unchanged from the stack upgrade).
- **No version bump, tag, release or publish.**
- **196 tests are the regression floor.** `type-check`, `lint` and `build` stay clean.
- **The renderer is the product:** a compiler adoption needs a human smoke test of the app, the same
  standard the React 19 track was held to (`react-19.md` §Verification mode) — machine gates cannot prove
  the UI renders or that the live timer stays correct.
- **English artifacts, conventional commits, no AI attribution.**
- **A spike that is not adopted leaves no residue:** the feature branch is the only place its config
  changes live until a decision is taken.

## Verification mode

- **TDD: not enabled** (unchanged; nothing in the repo enables it). Ordinary functional verification.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Extra gate:** a **human smoke test of the packaged app** — specifically `WorkTimeForm` (live timer,
  date/duration pickers) and the tables, because the compiler rewrites component bodies.

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `eslint.config.mjs`, `src/**`, `src/tests/**`, and this
document. Nothing else is in scope for this track.

**Not authorized by this track:** any runtime dependency upgrade, any version bump/tag/publish, and any
source refactor that is not a compiler-required fix or a regression fix the adoption surfaces.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| G1 | **Measured spike (read + build experiment):** wire the compiler on this branch, build with diagnostics captured, measure bail-outs (esp. `WorkTimeForm`), tests, type-check, lint, bundle size — for the Babel path and, if useful, the Rust path. Produce a go/no-go recommendation. | `vite.config.ts`, `package.json`, throwaway logger | direct inline (config experiment + command runs; the value is the measurement, not multi-file edits) | [x] — measured; spike reverted, no residue. Results in E5–E11 and the section below. |
| G2 | **Decision + adoption (or revert):** on a go, land the chosen path as the real build config; on a no-go, revert the spike and record why. | `vite.config.ts`, `package.json` | per G1 outcome | [x] — **decision A: closed as a measured no-go.** Spike reverted; no build configuration change. |
| G3 | **Lint gate for compiler violations:** add the compiler's lint coverage (the `eslint-plugin-react-compiler` rules or the equivalent) so a future Rules-of-React violation fails the gate instead of silently skipping compilation. | `eslint.config.mjs`, `package.json` | per G2 outcome | [x] — **not pursued (moot):** no compiler in the build, so there is nothing to gate. The one-off audit is E11; the real violations are carried as a follow-up (Resume item 2). |
| G4 | **Record results, evidence and residue here**, and reconcile with `react-19.md` / `performance-fase-0-1.md`. | this document | direct inline | [x] — recorded here (E5–E11, the G1 section, Progress, Resume); the Fase 2 consequence is stated in the G1 section and Resume item 3. |

## G1 — Measured spike results (2026-10-03)

**Method.** On `feat/react-compiler`: captured the baseline, installed both integration paths in turn, built
the **whole renderer** with the compiler enabled and a logger that records *every* compiler event
(`CompileSuccess` / `CompileError` / `CompileSkip`) to disk, then read and grouped the events. `WorkTimeForm`
was probed once more with a **temporary, behavior-preserving** rewrite to see whether its blocker was a
one-line fix. **All spike edits and dependencies were then reverted**; `git status` shows only this document.

**Numbers.**

| Metric | Baseline (no compiler) | Babel path | Rust path (`oxc-transform-react@0.145.0`) |
|---|---|---|---|
| Renderer build time | 3.77 s | **9.58 s** (+5.81 s) | **4.10 s** (+0.33 s) |
| Renderer JS bundle | **964,399 B** | **1,007,129 B** (+4.43%) | **1,018,380 B** (+5.60%) |
| Functions compiled / skipped | — | **80 / 52** | ~same skips (WorkTimeForm included) |
| `WorkTimeForm` compiled? | — | **No** | **No** |
| Tests exercised compiled output? | — | **No** (Vitest uses its own config) | **No** |

**Why `WorkTimeForm` does not compile — and cannot be fixed in one line.** Its first blocker is
`try/finally`; a behavior-preserving rewrite removed it and revealed a **second**, different limitation
(optional chaining in a logical test block, `WorkTimeForm.tsx:673`). The blockers are **layered** upstream
compiler gaps.

**Where the skips are concentrated.** 48 of 52 are compiler "Todo" limitations: `try/finally` (27) and
destructuring defaults (18) dominate; the rest are `TSNonNull` object keys, value blocks in `try/catch`,
and one optional-in-logical block. The 4 real findings are E11.

**Assessment — why the recommendation is **no-go for blanket adoption now**.**

1. **The track's own goal is not reachable.** The reason Track G exists is `WorkTimeForm`'s per-second
   re-render during the live timer. That component is skipped, and making it compilable means working around
   **multiple** upstream compiler gaps, not adopting a tool.
2. **Coverage is partial and inverted.** 61% of functions compile; the 39% that do not are the largest,
   most stateful screens (E8). Adopting would give memoization mostly where it is least needed.
3. **It costs for that partial coverage.** +4.4% (Babel) to +5.6% (Rust) bundle, and — on the Babel path —
   a **+154% renderer build time**. The Rust path is cheap but explicitly **experimental** and its peer
   version is already outside plugin-react's declared range (E9).
4. **The blockers are upstream, not ours.** 48/52 are `Todo` (unimplemented compiler features). Waiting is a
   legitimate option; refactoring the app around compiler gaps is a large, open-ended commitment.

**Follow-up check (E11):** each non-Todo finding was read in source after the spike. **None is a safe code
change.** `useSkipper` is the documented TanStack pattern (a behaviour-identical refactor does not exist,
and it is only needed *if* the compiler is adopted); the TanStack Table and RHF incompatibilities are
library-level; and `input-time.tsx`'s memo is deliberate and correct. **No follow-up patch is warranted** —
the flags are a useful audit, not a bug list. The lesson: a compiler flag is a hypothesis; read the source
before calling it a defect.

**Consequence for `performance-fase-0-1.md` Fase 2:** the compiler cannot carry the re-render work for
`WorkTimeForm`, so Fase 2 should be planned as **targeted manual memoisation / structural fixes**, not
deferred to the compiler. This resolves the dependency `react-19.md:438-442` recorded.

## Progress

- 2026-10-03 — Track G opened on `feat/react-compiler` (off `staging` @ `651b986`). Toolchain inventory
  measured: **two** integration paths exist (E1), React 19 needs no runtime package (E2), the current build
  is Oxc-only (E3), and two Rules-of-React hazards are already in the renderer (E4). Baseline captured
  **before** any compiler change: `npm test` **196/196** (21 files), `vite build` renderer JS
  **964,399 B** (`dist-vite/assets/index-BB_QvrXf.js`), main `547.01 kB`, preload `7.39 kB`,
  `pnpm install --frozen-lockfile` clean.
- 2026-10-03 — Babel path installed for the spike: `babel-plugin-react-compiler@1.0.0`,
  `@rolldown/plugin-babel@0.2.4`, `@babel/core@8.0.6`.
- 2026-10-03 — **G1 measured. Result: the compiler skips `WorkTimeForm` and 52 of 132 candidate functions
  (E5–E9).** Babel path: build OK, renderer 9.58 s (+154%), bundle +4.43%. Rust path: build OK, 4.10 s,
  bundle +5.60%, same `WorkTimeForm` skip. `WorkTimeForm` has **layered** compiler blockers — removing
  `try/finally` exposed an optional-chaining-in-logical-block gap (E7). **Spike reverted: no residue** —
  `vite.config.ts` and `WorkTimeForm.tsx` restored, all four spike dependencies removed, `package.json` and
  `pnpm-lock.yaml` back to `HEAD`, `pnpm install --frozen-lockfile` green. `git status` shows only this doc.
- 2026-10-03 — **G2 decided: A — Track G closed as a measured no-go.** The user weighed C (fix everything
  the compiler flags) against A and chose A: C is open-ended, partly impossible (TanStack Table and RHF
  `watch()` are incompatible **by design**, so its ceiling is below 100%) and would rewrite idiomatic code
  around temporary upstream `Todo` gaps that the React team will implement. The real Rules-of-React
  violations (E11) are carried as a separate small follow-up, not contorted into this track.
- 2026-10-03 — **Follow-up verification: no code change warranted (E11 corrected).** Read each non-Todo
  finding in source before patching. `input-time.tsx`'s `[optionsKey]` memo is deliberate and correct —
  changing its deps would reintroduce the Track A picker regression; `useSkipper` is the documented TanStack
  pattern with no behaviour-identical refactor; the TanStack Table / RHF `watch()` incompatibilities are
  library-level. **Record only — no `src/**` change.** The earlier "real violations to fix" framing was drawn
  from compiler flags without reading the code, and is corrected here.

## Resume — the next session starts here

State at hand-off: **Track G is CLOSED — decision A, measured no-go (2026-10-03).** No build change; this
document is the record and the tree is clean.

1. **Decision taken: A — closed as a measured no-go.** Rationale is the four reasons in the G1 section:
   the track's goal (`WorkTimeForm`) is unreachable without layered workarounds (E7); coverage is partial
   and inverted (E5, E8); it costs bundle and build time for that coverage (E9); and 48/52 skips are
   upstream `Todo` gaps that the React team will implement (E6), so refactoring around them today is
   throwaway churn. **Revisit trigger:** when React Compiler implements `try/finally` and destructuring
   defaults, re-run the spike — the harness and baseline are recorded here and it takes ~10 minutes.
2. **No follow-up patch (verified in source — E11).** `useSkipper`'s ref-read during render is the documented
   TanStack pattern with no behaviour-identical fix (it only needs changing if the compiler is adopted);
   the TanStack Table (`useTable.tsx:98`) and RHF `watch()` (`SettingsPage.tsx:134`) incompatibilities are
   library-level; and `input-time.tsx`'s memo is deliberate. The flags are an audit record, not a bug list.
3. **Feed the decision back upstream:** `performance-fase-0-1.md` Fase 2 should be planned as targeted
   manual/structural re-render work, since the compiler cannot carry `WorkTimeForm` (E7, and the G1
   consequence note). Align `react-19.md`'s Resume item 4, which left this choice to Track G.
4. **If adoption is ever revisited,** the compiler preset must be added to **both** `vite.config.ts` and
   `vitest.config.ts` (E10), and the existing manual memoisation in `input-time.tsx` will need its deps
   corrected (E11) or the compiler will keep skipping it.
