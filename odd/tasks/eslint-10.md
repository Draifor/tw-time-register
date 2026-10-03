# ESLint 10 + @eslint-react — Track E of the stack upgrade

## Objective

Move the lint toolchain to **ESLint 10.12.0** and **typescript-eslint 8.71.0**, replacing the
ESLint-10-incompatible `eslint-plugin-react` / `eslint-plugin-react-hooks` pair with
**`@eslint-react/eslint-plugin`** (current stable 5.x, ESLint-10-ready). All gates stay green and the
196-test floor is preserved. A secondary, explicitly-deferred goal from Track D is delivered here: the
`typescript-eslint` bump accepts the aliased TS 6.0 API, so the **duplicate `typescript@5.8.3` instance and
the peer warning disappear** (Track D E14).

## Problem

The repo is on **`eslint` 9.39.1** while **10.12.0** is current, and on **`typescript-eslint` 8.48.1** while
**8.71.0** is current. Track E is named in the stack-upgrade plan (`odd/tasks/react-19.md:46`) as
`eslint` (major) + `typescript-eslint` (minor inside 8), and Track D explicitly handed its stale-ts-eslint
residue to this track (`odd/tasks/typescript-7.md:136-139`). It needs its own feature document, exactly as
Tracks A, B, C, D and F did.

This is that document.

## Why the migration, and not a clean eslint 9 → 10 bump

**Measured, not assumed.** The ESLint 10 bump is gated by exactly one package, and it is not the one the
plan expected to be the hard part:

1. **`eslint-plugin-react@7.37.5` (latest published) does not support ESLint 10.** Its peer range stops at
   `^9.7`, so a strict install disagrees; worse, it is **runtime-incompatible**: it calls the
   `context.getFilename()` / `context.getSourceCode()` APIs that ESLint 10 **removed**, so rules fail to
   load with `contextOrFilename.getFilename is not a function` (E5). Two rules active in this repo's config
   crash: `react/function-component-definition` (warn) and `react/jsx-filename-extension` (error).
2. **The fix is not published.** The upstream compatibility PR (`jsx-eslint/eslint-plugin-react#4022`) is
   still unmerged and there is no v8 on npm (`latest = 7.37.5`, `next = 7.8.0-rc.0`) (E5).
3. **Everything else already supports ESLint 10.** `@eslint/js@10`, `eslint-plugin-prettier`, `globals` and
   node 22.17 all qualify; `eslint-plugin-react-hooks` needs only a bump to 7.1.1 (E2–E4).
4. **`@eslint-react` is the drop-in that unblocks 10**, and it ships **verbatim ports** of the two rules this
   repo actually relies on — `rules-of-hooks` and `exhaustive-deps` (E6–E7). So the React linting surface can
   be replaced by a single ESLint-10-ready plugin.

The alternatives were a `@eslint/compat` `fixupPluginRules()` shim around an officially-unsupported plugin,
or deferring the ESLint major to a follow-up track. **Decision taken 2026-10-03 by the user: full migration to
`@eslint-react`.**

## The gap (measured 2026-10-03)

| Package | Have (installed) | Target | Nature | Risk |
|---|---|---|---|---|
| `eslint` | `9.39.1` | **`10.12.0`** | major; flat config default, removed deprecated APIs | medium |
| `@eslint/js` | `9.39.1` | **`10.0.1`** | major, tracks eslint | low |
| `typescript-eslint` | `8.48.1` | **`8.71.0`** | minor inside 8; widens TS peer to `<6.1.0` | low |
| `eslint-plugin-react` | `7.37.5` | **removed** | replaced by `@eslint-react` | — |
| `eslint-plugin-react-hooks` | `7.0.1` | **removed** | replaced by `@eslint-react` | — |
| `@eslint-react/eslint-plugin` | — | **`5.23.5`** (current stable) | new; aggregates 7 sub-plugins | medium |
| `eslint-plugin-prettier` | `5.5.4` | `5.5.6` | patch; keeps eslint `>=8` peer | low |
| `eslint-config-prettier` | `10.1.8` | unchanged | eslint peer `>=7` | low |
| `globals` | `16.5.0` | `17.13.0` | major, no eslint peer | low |
| Node | `22.17.0` | — | satisfies eslint 10 engines (E2, E9) | low |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **Exact gap.** Installed lint deps: `eslint` 9.39.1, `@eslint/js` 9.39.1, `typescript-eslint` 8.48.1, `eslint-plugin-react` 7.37.5, `eslint-plugin-react-hooks` 7.0.1, `eslint-plugin-prettier` 5.5.4, `eslint-config-prettier` 10.1.8, `globals` 16.5.0. npm latest: `eslint` 10.12.0, `@eslint/js` 10.0.1, `typescript-eslint` 8.71.0, `eslint-plugin-react-hooks` 7.1.1, `eslint-plugin-prettier` 5.5.6, `globals` 17.13.0; `eslint-plugin-react` latest is still 7.37.5. | `pnpm list … --depth 0`; `npm view <pkg> version` |
| E2 | **Node is not a blocker.** `eslint@10.12.0` and `@eslint/js@10.0.1` engines are `^20.19.0 \|\| ^22.13.0 \|\| >=24`; installed `v22.17.0` satisfies them. The repo pins `.node-version = 22`. | `npm view eslint@10.12.0 engines`; `node -v` → `v22.17.0`; `.node-version` = `22` |
| E3 | **`@eslint/js@10.0.1` peers `eslint ^10.0.0`** — must move in lockstep with the major. | `npm view @eslint/js@10.0.1 peerDependencies` |
| E4 | **`typescript-eslint@8.71.0` accepts the aliased TS 6.0 API.** Peer: `eslint ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0`, `typescript >=4.8.4 <6.1.0`. This repo's `typescript` resolves to `@typescript/typescript6@6.0.2` (Track D), which is inside `<6.1.0` — so pnpm stops resolving a separate `typescript@5.8.3` peer and the peer warning disappears (**this closes Track D E14**). | `npm view typescript-eslint@8.71.0 peerDependencies`; `odd/tasks/typescript-7.md:136-139`; `package.json:99` (`"typescript": "npm:@typescript/typescript6@^6.0.2"`) |
| E5 | **`eslint-plugin-react` is the block, at both peer and runtime level.** Peer: `^3 \|\| … \|\| ^9.7` (no 10). Runtime: 38/101 rules crash on ESLint 10.12.0 with `contextOrFilename.getFilename is not a function` / `context.getSourceCode is not a function` / `sourceCode.isSpaceBetweenTokens is not a function`, because ESLint 10 removed those APIs. The two rules active in this repo's config that crash are `react/function-component-definition` (`function-component-definition`) and `react/jsx-filename-extension` (`jsx-filename-extension`). The fix is the unmerged PR `jsx-eslint/eslint-plugin-react#4022`; npm `latest` is still 7.37.5 and `next` is the stale 7.8.0-rc.0 (no v8 line). | `npm view eslint-plugin-react@7.37.5 peerDependencies`; `npm view eslint-plugin-react dist-tags`; react/react#35729 (user-reproduced crash); eslint10 plugin-compat matrix (booyaka101.github.io/eslint10-matrix) |
| E6 | **`@eslint-react/eslint-plugin` is the drop-in and is ESLint-10-ready.** Current `latest = 5.23.5`; peer `eslint: '*'`, `typescript: '*'`; engines `node >=22.0.0` (satisfied, E2). It is a meta-package aggregating `eslint-plugin-react-x`, `-react-dom`, `-react-jsx`, `-react-rsc`, `-react-web-api`, `-react-naming-convention`. The compatibility matrix measures 5.23.5 as **clean (82 rules ok)** on `eslint 10.12.0`. | `npm view @eslint-react/eslint-plugin dist-tags version peerDependencies engines`; `npm view @eslint-react/eslint-plugin@5.23.5 dependencies`; eslint10 matrix |
| E7 | **`@eslint-react` ships verbatim ports of the hooks rules this repo uses.** `@eslint-react/exhaustive-deps` and `@eslint-react/rules-of-hooks` are documented as "**ported _verbatim_ from `eslint-plugin-react-hooks`**". It also provides a `disable-conflict-eslint-plugin-react-hooks` preset for migrations, but nothing here needs both plugins if we migrate fully. | rel1cx/eslint-react `migrating-from-eslint-plugin-react-hooks` docs; rule READMEs |
| E8 | **The config surface is small and has no type-aware linting.** `eslint.config.mjs` imports `eslint-plugin-react` + `eslint-plugin-react-hooks` and sets a fixed rules block; there is **no** `parserOptions.project` / `projectService` / `recommendedTypeChecked`. Only four `react*` rules are enabled beyond the base configs (`function-component-definition` warn, `jsx-filename-extension` error, `rules-of-hooks` error, `exhaustive-deps` warn). | `eslint.config.mjs:1-7,34-96`; `rg projectService\|recommendedTypeChecked eslint.config.mjs tsconfig.json` → none |
| E9 | **Lint is a local gate only; CI does not run it.** The only workflow is `.github/workflows/release.yml`; it contains no `lint`/`eslint` step (it installs and builds). So the ESLint major cannot break CI directly — but the local/repo gate must stay green. | `Get-ChildItem .github/workflows`; `rg lint\|eslint .github/workflows/` → none; `odd/tasks/typescript-7.md:60,63` |
| E10 | **The only inline rule references are to the hooks rules.** Seven `// eslint-disable-next-line` comments reference `react-hooks/rules-of-hooks` (4) and `react-hooks/exhaustive-deps` (3); **no** source file references a `react/…` rule name in a disable comment, so only these seven comments need re-pointing. | `rg "eslint-disable.*react" src/` → `src/main/preload.ts:141`, `src/renderer/hooks/useTable.tsx:34,36,49`, `src/renderer/components/SelectLanguage.tsx:36`, `src/renderer/components/TotalTimeDay.tsx:52`, `src/renderer/components/ui/input-time.tsx:82` |

## Constraints

- **Node stays on 22.** E2 shows 22.17.0 satisfies every target. Do not bump `.node-version` or CI.
- **No version bump, tag, release or publish in this track.** Separate human decisions.
- **196 tests are the regression floor.** The suite must not go down.
- **`pnpm install --frozen-lockfile` must exit 0 with no `typescript` peer warning** (E4's observable proof; the broader “single `typescript`” claim measured false — see E2).
- **The prohibited shortcut:** installing `eslint@10` with `--force` / `--legacy-peer-deps` while keeping
  `eslint-plugin-react` is out of scope — it breaks `npm run lint` by construction (E5).
- **Keep the effective rule coverage.** `rules-of-hooks` must stay `error` and `exhaustive-deps` `warn`
  (their `@eslint-react` equivalents). The `@eslint-react` recommended set is adopted where it stays green;
  any rule tuned off carries a one-line justification.
- **Track-scoped:** no app-code changes beyond the seven disable-comment re-points (E10); no React Compiler
  (Track G), Tailwind, Vite, Vitest or TS changes.
- Conventional commits, English artifacts, no AI attribution.

## Verification mode

- **TDD: not enabled** — unchanged from Tracks A–D/F. This is a lint-tooling track; ordinary functional
  verification applies.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run lint`, `npm run type-check`, `npm test`,
  `npm run build`, `pnpm install --frozen-lockfile`.
- **Extra gates for this track (prove the wiring):**
  - `pnpm exec eslint --version` → a **10.x** version;
  - `pnpm install --frozen-lockfile` exits 0 **without** the `@typescript-eslint/parser ✕ unmet peer
    typescript@"<6.0.0"` warning (Track D E14);
  - `pnpm why typescript` / lockfile inspection shows this track introduced **no new** `typescript`
    resolution (the `5.9.3` and `6.0.3` entries pre-date it, E2);
  - `eslint-plugin-react` and `eslint-plugin-react-hooks` are **absent** from `package.json` and the lockfile.
- **No human smoke test.** This track changes lint tooling only; the shipped bundle is built by
  Vite/Rolldown and is untouched (Track D E8/E16), so the proportional instrument is the machine gate set.
- **Measured migration, not blind preset adoption.** Each step is verified separately: (1) safe bumps on
  ESLint 9, (2) the React-plugin migration on ESLint 9, (3) the ESLint 9 → 10 major. Isolating the two
  failure modes is deliberate.

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, the five files carrying the seven inline
`react-hooks/*` disable comments (`src/main/preload.ts`, `src/renderer/hooks/useTable.tsx`,
`src/renderer/components/SelectLanguage.tsx`, `src/renderer/components/TotalTimeDay.tsx`,
`src/renderer/components/ui/input-time.tsx`), and this document.

**Not authorized by this track:** other `src/**` application code, other tracks' config or versions, and any
version bump, tag or publish. If the `@eslint-react` recommended set surfaces real findings in `src/**`, they
are **recorded as follow-ups or tuned with a per-rule justification** — not mass-fixed here, to keep the track
bounded and reviewable.

## Tasks — Track E

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| E1 | **Baseline on the fork point** — capture `npm test` (floor 196), `type-check`, `lint`, `build`, `pnpm install --frozen-lockfile`, and the installed lint versions as the regression floor | — | per-action worker (read-only verification) | [x] — **done 2026-10-03.** Baseline at `fe1f6bb`: `npm test` **196/196** across 21 files (vitest 5.0.3); `type-check`, `lint`, `build`, `pnpm install --frozen-lockfile` all exit 0; `eslint` **9.39.1**. `dist-electron/index.js` **547,011 B** + `preload.js` **7,396 B**. Floor fixed at **196**. Caveat: the frozen path skipped resolution, so the peer warning was not observable there (proven in E2 instead). |
| E2 | **Safe bumps on ESLint 9 (no react-plugin change yet):** `eslint` → `9.39.5`, `@eslint/js` → `^9.39.5`, `typescript-eslint` → `^8.71.0`, `eslint-plugin-prettier` → `5.5.6`, `globals` → `^17.13.0`; regenerate the lockfile; prove the ts-eslint peer warning is gone | `package.json`, `pnpm-lock.yaml` | direct inline (one hand-authored dependency block; the inventory removed the unknowns) | [x] — **done 2026-10-03.** `pnpm install` exit 0; resolved `eslint` **9.39.5**, `@eslint/js` **9.39.5**, `typescript-eslint` **8.71.0**, `eslint-plugin-prettier` **5.5.6**, `globals` **17.13.0**. The `✕ unmet peer typescript` warning is **gone**: the only peer issues printed are the pre-existing `electron-builder`/`dmg-builder` mismatch. `npm run lint` exit 0, **196** tests still the floor. Correction to Track D E14: the committed lockfile never carried `typescript@5.8.3`; the `5.9.3` (`config-file-ts`) and `6.0.3` (`@typescript/old`) entries are pre-existing and unrelated to this bump. |
| E3 | **Migrate the React plugins to `@eslint-react` (still ESLint 9):** remove `eslint-plugin-react` + `eslint-plugin-react-hooks`; add `@eslint-react/eslint-plugin@^5.23.5`; rewrite `eslint.config.mjs` to the flat `eslintReact.configs["recommended-typescript"]` shape, porting the four enabled rules; re-point the seven inline disables (E10) | `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, 5 source files | direct inline (one config file + mechanical comment re-points; the preset was inspected empirically first) | [x] — **done 2026-10-03.** `pnpm install` exit 0 (`+16 -172`); `@eslint-react/eslint-plugin` **5.23.5** added, both `eslint-plugin-*react*` removed; peer issues printed are only the pre-existing `electron-builder`/`dmg-builder` mismatch. `eslint.config.mjs` now extends `eslintReact.configs['recommended-typescript']` (65 rules, verified to include `@eslint-react/rules-of-hooks` = **error** and `@eslint-react/exhaustive-deps` = **warn**, and to need **no** `projectService`). The seven inline disables were re-pointed to `@eslint-react/*`; `eslint` reports **no** `rule not found`. |
| E4 | **Tune to green:** run `npm run lint`, triage every finding, adopt/justify each `@eslint-react` rule; fix only what belongs in scope, record the rest as follow-ups | `eslint.config.mjs` | direct inline (design/measure loop) | [x] — **done 2026-10-03; the user chose to adopt the full preset.** `pnpm exec eslint .` exits **0** with **0 errors and 83 warnings** across 29 files. No rule was disabled. The warnings are recorded as a deliberate baseline and as follow-ups (see Residue); none is fatal and none belongs to a lint-tooling track. |
| E5 | **ESLint 9 → 10 major:** `eslint` → `^10.12.0`, `@eslint/js` → `^10.0.1`; re-run lint and resolve any ESLint-10-specific findings | `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs` | direct inline (version bump + measured follow-up) | [x] — **done 2026-10-03.** `pnpm install` exit 0 (`+44 -43`); `eslint` **10.12.0**, `@eslint/js` **10.0.1**. `pnpm exec eslint --version` → **v10.12.0**; `eslint .` exits **0** with the **same 0 errors / 83 warnings** — no ESLint-10-specific finding, no config change needed. Only the pre-existing `electron-builder` peer mismatch is printed. |
| E6 | **Full gates:** `pnpm install --frozen-lockfile`, `lint`, `type-check`, `npm test` (≥196), `build`; confirm no peer warnings and a single `typescript` | — | per-action worker (read-only verification) | [x] — **done 2026-10-03, VERDICT PASS.** `pnpm install --frozen-lockfile` exit 0 with **no peer warnings**; `pnpm exec eslint --version` **v10.12.0**; `npm run lint` exit 0 (**0 errors / 83 warnings**, all `@eslint-react/*`); `type-check` 0; `npm test` **196/196** across 21 files; `npm run build` 0. Neither legacy plugin is in `package.json` or the lockfile, and `typescript@5.8.3` is absent. Bundle sizes and the +8 B delta are recorded in Residue. |
| E7 | **Record results, evidence and residue here**, run the native review of the scoped candidate, then close the track | this document | direct inline | [x] — **done 2026-10-03.** Native review **approved**, authority **burned** (lineage `review-1e551d07dc0db568`, one `review-reliability` lens, medium, **no correction opened**); the two advisory findings are recorded in the Review record. This closing commit is the last work unit. Push and PR remain the user's decision. |

## Acceptance criteria

- `pnpm exec eslint --version` reports **10.x**; `typescript-eslint` is **8.71.0** (or newer within 8).
- `eslint-plugin-react` and `eslint-plugin-react-hooks` are gone; `@eslint-react/eslint-plugin` is the React
  linting plugin.
- **At least 196 tests pass**; `lint`, `type-check`, `build` are clean.
- `pnpm install --frozen-lockfile` exits 0 **with no `typescript` peer warning** (E4), and the bump
  introduces **no new** `typescript` resolution.
- `rules-of-hooks` = error and `exhaustive-deps` = warn survive under `@eslint-react`.
- **No `src/**` changes except the seven disable-comment re-points** (E10) unless a recorded finding forces
  otherwise.
- **No human smoke test is claimed**; the shipped bundle is untouched by construction.
- Anything the upgrade cannot fix within this track is recorded as a finding, not quietly left.

## Residue

- **Two pre-existing `typescript` transitives remain and are not this track's to remove:** `typescript@5.9.3`
  (via `electron-builder` → `config-file-ts`) and `typescript@6.0.3` (via the `@typescript/typescript6`
  package's internal `@typescript/old` alias). Track D E14's "duplicate `typescript@5.8.3`" was a stale
  `.pnpm` directory, not a lockfile entry (E2).
- **`eslint@9.x` is deprecated on npm** (`WARN deprecated eslint@9.39.5: This version is no longer
  supported`). Expected and transient: E5 moves to the supported `10.x` line.
- **Two `eslint-plugin-react` rules were dropped with no direct `@eslint-react` equivalent:** `react/function-component-definition` (warn) and `react/jsx-filename-extension` (**error**) — the migration guide offers the former only through the extra `@eslint-react/kit` package and has no equivalent for the latter. The codebase already conforms to both, so nothing regressed, but the guarantee is gone.
- **The 83-warning `@eslint-react` baseline (E4) is deliberate, not debt left unnoticed:** `no-forward-ref` 47, `no-array-index-key` 12, `set-state-in-effect` 8, `use-state` 7, `purity` 6, plus `no-unnecessary-use-prefix`, `naming-convention-ref-name` and `web-api-no-leaked-timeout` 1 each. `no-forward-ref` is largely the shadcn `components/ui/*` files (React 19 deprecates `forwardRef`) and is the natural companion to the React 19 track; the rest are real but out of scope for a lint-tooling track. Non-blocking (`eslint` exits 0).
- **Bundle-size anomaly, resolved as not-ours:** `dist-electron/index.js` measures **547,019 B** on this
  candidate versus the **547,011 B** recorded in Track C, Track D (E16) and the E1 baseline. Rebuilding with the
  **baseline** `src/main/preload.ts` still produces **547,019 B**, the artifact is deterministic (two builds,
  identical SHA-256 `9E320E9C…`), `vite`/`rolldown`/`electron`/`electron-updater` are the same versions as the
  baseline, and no non-comment main-process source changed — so the earlier figure is unreproducible, not a
  regression. `preload.js` is unchanged at **7,396 B**. The artifact is gitignored and not part of the PR.
- _(further residue recorded as the track advances)_

## Review record

Native review of the scoped candidate (9 paths, 3,028 changed lines including the generated lockfile, tier
**medium**), lineage `review-1e551d07dc0db568`, one lens `review-reliability`, correction budget 200 — **no
correction opened**. Consent was relayed and **granted** by the user; the reviewer captured on the **first**
attempt; the exact acknowledgement burned the authority (`gentle-ai.review-acknowledged/v1`,
`consumed_revision` `sha256:fdf1c2fd…`).

Two non-blocking advisory findings, recorded as follow-ups (never a reason to re-review this candidate):

| ID | Severity | Claim | Disposition |
|---|---|---|---|
| R3-1 | WARNING | Dropping `eslint-plugin-react` silently lowers the machine gate: `react/jsx-filename-extension` (**error**) and `react/function-component-definition` (warn) have no `@eslint-react` equivalent, and the candidate records the loss as residue without a follow-up task to restore an equivalent. | **Valid and honest — already recorded in Residue as a coverage loss.** `@eslint-react` offers the component-definition rule only through the extra `@eslint-react/kit` package and has no equivalent for the filename-extension rule at all; the codebase conforms to both today. Restoring an equivalent (custom rule or a lint test) is a **candidate follow-up**, not part of a lint-tooling migration. Not patched here — a source change after the review freeze would need a new candidate. |
| R3-2 | SUGGESTION | The seven re-pointed inline disables only work while a rule named exactly `@eslint-react/rules-of-hooks` / `@eslint-react/exhaustive-deps` exists; a future rename would turn them into silent no-ops with nothing to fail. | **Valid.** The candidate proves the rule ids only indirectly (lint exit code and the 83-warning inventory). The cheap close — enable `--report-unused-disable-directives` (or add an assertion) so a renamed rule fails the gate — is a **candidate follow-up**; on the current candidate the directives are demonstrably consumed (the inventory matches the pre-migration 83 warnings). |

## Delivery plan

`delivery_strategy: ask-on-risk` (the repo default). The authored change is two hand-edited files
(`package.json`, `eslint.config.mjs`) plus seven one-line comment re-points; `pnpm-lock.yaml` is generated and
excluded — far under the ~400-line budget. **One feature branch (`feat/eslint-10`, off `staging` @ `fe1f6bb`,
which carries Tracks C and D) and a single PR to `staging`.** Push and PR remain the user's call.

## Progress

- 2026-10-03 — **Track E opened with the measured inventory; the shape was corrected before any write.** The
  plan expected a clean `eslint` major + `typescript-eslint` minor. Measurement showed the major is blocked by
  `eslint-plugin-react`, which is both peer- and runtime-incompatible with ESLint 10 (E5) and has no published
  fix. The user chose to migrate the React linting to `@eslint-react` (ESLint-10-ready, verbatim hooks ports,
  E6–E7) and deliver the major. Branch `feat/eslint-10` created off `staging` (`fe1f6bb`). No dependency has
  moved yet. **Note:** the option referenced `@eslint-react` **v4** (the first ESLint-10-only line); this track
  targets the current stable **5.23.5**, which the compat matrix validates against ESLint 10.12.0. Pinning 4.x
  instead is a one-line version change before E3.
- 2026-10-03 — **E1 baseline + E2 safe bumps done; gates green.** E1 fixed the floor at **196/196** on
  `fe1f6bb` (eslint 9.39.1). E2 moved the four lint deps on ESLint 9 and regenerated the lockfile: `eslint`
  **9.39.5**, `typescript-eslint` **8.71.0**, `eslint-plugin-prettier` **5.5.6**, `globals` **17.13.0**. The
  `@typescript-eslint/parser ✕ unmet peer typescript` warning is **gone** (E4 delivered). Corrected Track D
  E14: the committed lockfile never contained a `typescript@5.8.3` duplicate. `npm run lint` exit 0. **Next:
  E3 — migrate the React plugins to `@eslint-react` on ESLint 9.**
- 2026-10-03 — **E3 + E4 done; the React plugins are migrated and the lint gate is green on ESLint 9.** E3
  added `@eslint-react/eslint-plugin` **5.23.5**, removed `eslint-plugin-react` + `eslint-plugin-react-hooks`,
  rewrote `eslint.config.mjs` around `recommended-typescript`, and re-pointed the seven inline disables. The
  preset was inspected empirically before wiring: 65 rules, `rules-of-hooks` = error, `exhaustive-deps` =
  warn, no `projectService` needed. E4: the user chose the **full preset**; `eslint .` exits **0** with **0
  errors / 83 warnings** across 29 files, recorded as the new baseline and as follow-ups. **Next: E5 — the
  ESLint 9 → 10 major.**
- 2026-10-03 — **E5 done; ESLint 10 is in and the lint gate is still green.** `@eslint/js` **10.0.1** and
  `eslint` **10.12.0** resolved cleanly (no new peer warnings). `eslint .` exits **0** with the **identical
  0 errors / 83 warnings** — the major needed **no** config change, confirming nothing in the config used an
  API that ESLint 10 removed. **Next: E6 — the full gate set.**
- 2026-10-03 — **E6 done; VERDICT PASS.** The read-only worker ran the whole pipeline on `93bbc9f`:
  `frozen-lockfile` 0 + no peer warnings, `eslint` **10.12.0**, `lint` **0 errors / 83 warnings**,
  `type-check` 0, **196/196** tests across 21 files, `build` 0. Legacy plugins and `typescript@5.8.3` are
  absent. One honest anomaly is recorded in Residue: the main bundle measures **547,019 B** now versus
  **547,011 B** captured in Track C/D and in E1. A controlled re-measurement (rebuilding with the **baseline**
  `preload.ts`) still yields **547,019 B**, and the build tools and `electron-updater` are byte-identical
  versions — so the delta is **not** Track E's source change; it is an unreproducible baseline figure. **Next:
  E7 — record, review, close.**
- 2026-10-03 — **E7 complete; Track E is CLOSED.** Native review **approved** with authority **burned**
  (lineage `review-1e551d07dc0db568`, one `review-reliability` lens, medium, no correction opened); the two
  advisory findings and their dispositions are recorded in the Review record. Work units: `1cb3be6`
  (`build(lint): bump eslint to 9.39.5 and typescript-eslint to 8.71.0`), `05d6128` (`build(lint): migrate
  React linting to @eslint-react`), `93bbc9f` (`build(lint): upgrade eslint to 10.12.0 and @eslint/js to
  10.0.1`), `503056a` (`docs(odd): record the ESLint 10 track gates`) plus this closing commit. **E1–E7
  complete.** Push and PR remain the user's decision.
