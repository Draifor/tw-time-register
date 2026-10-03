# TypeScript 7 (native) — Track D of the stack upgrade

## Objective

Adopt **TypeScript 7.0.2** — the native Go compiler (`tsc`) — for CLI type-checking and the main-process
`tsc` build, **without** moving the `typescript` module that `typescript-eslint` imports: that one must stay
on the **TS 6.0 API**, because TypeScript 7.0 ships no compiler API until 7.1. All gates stay green and the
196-test floor is preserved.

## Problem

The repo is on **`typescript` 5.8.3** while **7.0.2** is current. Track D is named in the stack-upgrade plan as
"TypeScript 7 (native port — highest uncertainty)" (`odd/tasks/react-19.md:433-435`). It needs its own feature
document, exactly as Tracks A, B, C and F did.

This is that document.

## Why side-by-side, and not a clean swap

**Measured, not assumed.** TypeScript 7.0 is the native port completed; it is not a drop-in for the `typescript`
package:

1. **TS 7.0 ships no programmatic compiler API.** It is a CLI compiler (`tsc`) only; the API is expected in
   TypeScript 7.1 (E2). Every tool that `import`s `typescript` and walks the AST breaks against it.
2. **`typescript-eslint` cannot run against TS 7** — the latest release (8.71.0) declares its peer as
   `typescript >=4.8.4 <6.1.0`, and forcing the install makes ESLint crash inside
   `@typescript-eslint/typescript-estree` (E3). This repo's `eslint.config.mjs` uses
   `tseslint.configs.recommended`, so `npm run lint` is directly in that path.
3. **Microsoft documents the transition as side-by-side**, not a swap: keep the `typescript` name resolving to
   the TS 6.0 API package (so tools keep working) and install TS 7 under a separate alias for the `tsc` CLI
   (E5). Because this repo's ESLint config has **no type-aware rules**, the TS 6 API is used only to *parse*,
   not to type-check — so there is no risk of two checkers disagreeing (E4).

The alternative — a single-compiler swap — is blocked upstream until TS 7.1 restores the API and
`typescript-eslint` widens its peer range. **Decision taken 2026-10-03: side-by-side.**

## The gap (measured 2026-10-03)

| Item | Have (installed) | Target | Nature | Risk |
|---|---|---|---|---|
| `typescript` (the API module) | `5.8.3` | **`@typescript/typescript6` 6.0.2** (aliased as `typescript`) | major, API-bearing release | medium |
| `tsc` (the CLI compiler) | `5.8.3` | **`typescript` 7.0.2** (aliased as `@typescript/native`) | native port, no API | medium |
| `typescript-eslint` | `8.48.1` | unchanged (`8.71.0` latest also caps `<6.1.0`) | none required | low |
| Node | `22.17.0` | — | satisfies both compilers (E11) | low |
| Electron shipped bundle | — | — | built by Vite/Rolldown, not `tsc` (E8) | low |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **Exact gap.** Installed `typescript` is `5.8.3`; npm `latest` is `7.0.2` (native Go port). Its only bin is `tsc`; `engines.node` is `>=16.20.0`. Registry dist-tags: `latest 7.0.2`, `next 7.1.0-dev.*`, `rc 7.0.1-rc`. | `node -e "require('typescript/package.json').version"` → `5.8.3`; `pnpm view typescript version` → `7.0.2`; `pnpm view typescript@7.0.2 bin engines` → `bin = { tsc: 'bin/tsc' }`, `engines = { node: '>=16.20.0' }`; `pnpm view typescript dist-tags` |
| E2 | **TS 7.0 has no compiler API.** The announcement states it plainly: "TypeScript 7.0 does not ship with an API", expected in 7.1. The native-port feature matrix lists `API | not ready`. | devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (retrieved 2026-10-03); microsoft/typescript-go feature table |
| E3 | **`typescript-eslint` rejects TS 7 at the peer level, and crashes at runtime if forced.** Latest `8.71.0` peer: `typescript >=4.8.4 <6.1.0`. Upstream issue #12518 reproduces `npm ci` ERESOLVE and the runtime `Cannot read properties of undefined (reading 'Cjs')` in `typescript-estree` (it expects `ts.Extension.Cjs`, absent from the TS 7 entrypoint). The issue was closed **not planned** (the fix belongs on the TS side). | `pnpm view typescript-eslint version peerDependencies` → `8.71.0`, `typescript: '>=4.8.4 <6.1.0'`; `pnpm view @typescript-eslint/parser version peerDependencies` → same; github.com/typescript-eslint/typescript-eslint/issues/12518 |
| E4 | **This repo uses no type-aware lint rules**, so the TS 6 API is needed to *parse*, not to type-check. The config is `tseslint.config(...)` with `tseslint.configs.recommended` and a rules block; there is no `parserOptions.project` / `projectService` and no `recommendedTypeChecked`. Consequence: no dual-checker divergence — the only authoritative type-check is the TS 7 `tsc`. | `eslint.config.mjs:1-13,34-96`; `rg 'projectService|recommendedTypeChecked|parserOptions' eslint.config.mjs` → only `ecmaFeatures.jsx` |
| E5 | **The documented side-by-side shape, verified against the registry.** `@typescript/typescript6@6.0.2` provides bin `{ tsc6 }` and re-exports the full TS 6.0 API (`main: './lib/typescript.js'`, `types: './lib/typescript.d.ts'`). So aliasing `typescript` → that package keeps `import 'typescript'` on the API, and aliasing a second devDep to `typescript@^7.0.2` supplies the `tsc` binary. | devblogs.microsoft.com/typescript/announcing-typescript-7-0/ (side-by-side section); `pnpm view @typescript/typescript6 version bin` → `6.0.2`, `{ tsc6: 'bin/tsc6' }`; `pnpm view @typescript/typescript6@6.0.2 main types` → `./lib/typescript.js`, `./lib/typescript.d.ts` |
| E6 | **No stable `typescript@6.x` exists on npm**, so the compat package is the only route to the TS 6 API. The `typescript` version list contains only `6.0.0-beta` / `6.0.0-dev.*` for the 6.x line. | `pnpm view typescript versions --json` filtered to `"6.` |
| E7 | **The CLI consumers of `tsc` are exactly two, and both are pure CLI** — no API. `type-check` runs `tsc` on the root config (`noEmit`); `build:electron` runs `tsc -p src/main/tsconfig.json` (emits to `dist-electron`). Both work on TS 7 (Program creation, type checking, emit and tsconfig parsing are all "done" in the native feature matrix). | `package.json:26,33`; `tsconfig.json`; `src/main/tsconfig.json`; microsoft/typescript-go feature table |
| E8 | **The shipped Electron bundle is not produced by `tsc`.** `pnpm build` → `vite build` → `vite-plugin-electron` builds `src/main/index.ts` and `preload.ts` with Vite/Rolldown into `dist-electron` (`vite.config.ts:13-55,86-107`). `build:electron` (tsc) is only the `dev:electron` path (`package.json:23`). So the TypeScript version does **not** change the dispatched runtime artifact; the TS-7-specific test surface is `type-check` + `build:electron`. | `vite.config.ts:29-55`; `package.json:23,24,27` |
| E9 | **The rest of the toolchain does not import the TS API.** Vite 8 (Rolldown/Oxc), Vitest 5 and `@vitejs/plugin-react` 6 transpile TypeScript themselves; none of them requires the `typescript` package to build or test. | Track C record (`odd/tasks/vite-8.md`); no `import 'typescript'` in `vite.config.ts` / `vitest.config.ts` |
| E10 | **CI's install path and build path are unaffected by the TS bump except through the lockfile.** `.github/workflows/release.yml` runs `pnpm install --frozen-lockfile` (step 67-68) then `pnpm build` (70-71) — no `tsc` gate. So the load-bearing CI invariant is that the frozen lockfile still installs. | `.github/workflows/release.yml:67-71` |
| E11 | **Node is not a blocker.** Installed `v22.17.0` satisfies `typescript@7` `engines.node >=16.20.0` (E1) and the existing toolchain. | `node -v`; `.node-version` = `22` |
| E12 | **The config surface is small and already forward-looking.** Root `tsconfig.json` uses `jsx: "react"`, `moduleResolution: "bundler"`, `noEmit: true`; `src/main/tsconfig.json` uses `moduleResolution: "node"` and already carries `ignoreDeprecations: "6.0"`. Whether TS 6/7 accept these unchanged can only be settled by running `tsc`, not by reading docs. | `tsconfig.json:1-21`; `src/main/tsconfig.json:1-26` |
| E13 | **There is no CI type-check workflow to fix.** The only workflow is `release.yml`; globbing `.github/**` returns `.github/copilot-instructions.md` and `.github/workflows/release.yml`, nothing else. | `Get-ChildItem -Recurse .github -File` |
| E14 | **pnpm keeps a second `typescript` instance because the repo's `typescript-eslint` peer is stale.** The installed `typescript-eslint@8.48.1` declares `typescript >=4.8.4 <6.0.0`, which **excludes 6.0.2**, so pnpm (default `auto-install-peers`) resolves a separate `typescript@5.8.3` peer for ts-eslint instead of the aliased 6.0.2. `lint` still exits 0 (the API it parses against is supported either way). This is the peer warning `pnpm install` prints; it disappears with a ts-eslint minor bump, which is Track E's job, not this track's. | `pnpm install` peer warnings (`@typescript-eslint/parser 8.48.1 ✕ unmet peer typescript@">=4.8.4 <6.0.0": found 6.0.2`); `.pnpm` shows `@typescript-eslint+parser@8.48.1_...` resolved to both `@typescript+typescript6@6.0.2` and `typescript@5.8.3`; `eslint.config.mjs`; `npm run lint` exit 0 |
| E15 | **TS 7 removed `moduleResolution: "node10"`, and it was the only config break.** `npm run build:electron` first failed: `src/main/tsconfig.json(11,25): error TS5108: Option 'moduleResolution=node10' has been removed.` Removing that one line makes TS 7 emit cleanly; `ignoreDeprecations: "6.0"` is still accepted and the `jsx: "react"` / `moduleResolution: "bundler"` root config needed **no** change. The fix could not be proven by CLI override (the error is raised while parsing the config file), so it was settled by editing and re-running. | `npm run build:electron` exit 2 → TS5108; after removing the line, exit 0; `node --check dist-electron/main/index.js` exit 0; `npm run type-check` exit 0 with the root config untouched |
| E16 | **The dispatched runtime artifact did not change.** `npm run build` (Vite/Rolldown) emits `dist-electron/index.js` **547,011 B** and `dist-electron/preload.js` **7,396 B** — byte-for-byte the same sizes Track C recorded (`odd/tasks/vite-8.md:93`), because `tsc` is not in that path (E8). So Track D is build-tooling-only: the shipped app's bytes are independent of the TypeScript version, and a human smoke test is not the instrument for this change. | verify worker `npm run build` on `feat/typescript-7`; `odd/tasks/vite-8.md:93` (Track C: 547,011 B / 7,396 B) |

## Constraints

- **Node stays on 22.** E11 shows 22.17.0 satisfies every target. Do not bump `.node-version` or CI.
- **No version bump, tag, release or publish in this track.** Separate human decisions.
- **196 tests are the regression floor** (Track C's closing number). The suite must not go down.
- **The `typescript` module name must keep resolving to a TS 6 API package** for as long as
  `typescript-eslint` caps its peer below 6.1.0 (E3, E5). Do not "simplify" by pointing `typescript` at 7.x.
- **The prohibited shortcut:** installing `typescript@7` directly (or with `--force`/`--legacy-peer-deps`) is
  out of scope — it breaks `npm run lint` by construction (E3).
- **Track-scoped:** no ESLint (E), React Compiler (G), Tailwind or app-code changes.
- Conventional commits, English artifacts, no AI attribution.

## Verification mode

- **TDD: not enabled** — unchanged from Tracks A/B/C/F. Ordinary functional verification.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run type-check`, `npm run lint`, `npm run build`,
  `pnpm install --frozen-lockfile`.
- **Extra gates for this track (prove the two compilers are wired):**
  - `pnpm exec tsc --version` → **7.0.2** (the `tsc` CLI is the native compiler);
  - `node -e "console.log(require('typescript/package.json').version)"` → **6.0.2** (the `typescript` name
    resolves to the API package, so ESLint is safe). Note: that same package's embedded compiler
    self-reports **6.0.3**, so `tsc6 --version` prints 6.0.3 — the package identity is 6.0.2, the compiler
    inside it is 6.0.3 (E14's measurement);
  - `npm run build:electron` exits 0 and its emitted main-process CJS is syntax-valid
    (`node --check dist-electron/main/index.js` exits 0).
- **No human smoke test.** This track changes build tooling only: the shipped bundle is produced by
  Vite/Rolldown, not `tsc` (E8), and its output is byte-size-identical to Track C's (E16). The A6/B/C
  human-smoke standard applies to tracks whose **runtime** changes; here the proportional instrument is the
  machine gate set. This is a reasoned, evidenced decision, not a skipped check — and it is recorded as such.
- **Not a gate, but worth knowing:** `dev:electron` (`build:electron && electron .`) is inconsistent with
  `package.json`'s `main` (`dist-electron/index.js`): `tsc` emits to `dist-electron/main/index.js` because of
  `rootDir: ".."` (E7/E8). Pre-existing, unrelated to TypeScript 7, and out of scope — recorded so it is not
  mistaken for Track D fallout.

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `tsconfig.json` / `src/main/tsconfig.json` **only if** a measured TS 6/7
incompatibility forces it, and this document.

**Exercised:** the conditional clause fired exactly once — `src/main/tsconfig.json` lost its removed
`moduleResolution: "node"` (E15). No other tsconfig changed.

**Not authorized by this track:** `src/**` application code, other tracks' config or versions, and any version
bump, tag or publish.

## Tasks — Track D

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| D1 | **Inventory + feasibility (read-only):** measure the gap, the TS 7 API gap, the `typescript-eslint` peer block, and the exact CLI consumers of `tsc` | read-only | direct inline | [x] — **done 2026-10-03.** Findings E1–E13. The track's shape changed from "swap to TS 7" to "run TS 7 side-by-side with a TS 6 API module"; the user chose side-by-side. |
| D2 | **Apply the side-by-side:** `typescript` → `npm:@typescript/typescript6@^6.0.2`; add `@typescript/native` → `npm:typescript@^7.0.2`; regenerate the lockfile and prove the wiring (`pnpm exec tsc --version` 7.0.2, `require('typescript/package.json').version` 6.0.2) | `package.json`, `pnpm-lock.yaml` | direct inline (one hand-authored dependency block; the inventory removed the unknowns) | [x] — **done 2026-10-03.** `pnpm install` exit 0; resolved `@typescript/typescript6` **6.0.2** (as `typescript`) and `typescript` **7.0.2** (as `@typescript/native`). `pnpm exec tsc --version` → **7.0.2**; `require('typescript/package.json').version` → **6.0.2**; `tsc6` → 6.0.3 (embedded compiler, E14). Peer warnings are E14's stale ts-eslint range, not a Track D regression. |
| D3 | **Settle TS 6/7 config compatibility by running, not reading:** `npm run type-check` (TS 7 on the root config) and `npm run build:electron` (TS 7 emit on the main config); adapt a tsconfig **only** where the compiler actually rejects it | `tsconfig*.json` (conditional) | direct inline (measured, minimal) | [x] — **done 2026-10-03.** `type-check` passed with **zero** config change (root uses `bundler`). `build:electron` failed once with **TS5108** (`moduleResolution=node10` removed, E15); removing that single line from `src/main/tsconfig.json` made it exit 0, and the emitted main CJS passes `node --check`. `ignoreDeprecations: "6.0"` was left in place (TS 7 still accepts it). |
| D4 | **Full gates:** `npm test` (≥196), `type-check`, `lint` (`tseslint` on the TS 6 API), `build`, `pnpm install --frozen-lockfile` | — | per-action worker (read-only verification) | [x] — **done 2026-10-03, VERDICT PASS.** `frozen-lockfile` exit 0 (no peer warnings on the frozen path); `type-check` 0; `lint` 0; `npm test` **196/196** across 21 files, 0 failures; `npm run build` 0 with `dist-electron/index.js` **547,011 B** / `preload.js` **7,396 B** (E16); `npm run build:electron` 0 + `node --check` 0. Only the four expected paths changed. |
| D5 | **Runtime-verification decision (revised by measurement):** the shipped bundle is not built by `tsc` (E8) and is byte-size-identical to Track C's (E16), so a human smoke test does not exercise this change | — | — (not required; evidenced) | [x] — **resolved 2026-10-03: no human smoke test.** Recorded with its reasoning in Verification mode. If the user wants a launch anyway it is a re-check of the app, not of Track D. |
| D6 | **Record results, evidence and residue here**, run the native review of the scoped candidate, then close the track | this document | direct inline | [ ] |

## Acceptance criteria

- `pnpm exec tsc --version` is **7.0.2** and `require('typescript/package.json').version` is **6.0.2** (E5 wiring).
- **At least 196 tests pass**; `type-check`, `lint`, `build` are clean.
- `pnpm install --frozen-lockfile` exits 0 (CI's install path, E10) and `npm run build:electron` exits 0.
- **No changes under `src/**` except the one forced line removed from `src/main/tsconfig.json`** (E15).
- **No human smoke test is claimed**; the runtime artifact is unchanged by construction (E8, E16) and the claim
  is not overstated.
- Anything the upgrade cannot fix within this track is recorded as a finding, not quietly left.

## Residue

- **A duplicate `typescript@5.8.3` instance stays in the lockfile** because the repo's `typescript-eslint`
  (8.48.1) peer-excludes TS 6.0 (E14). It is inert — `lint` passes — and it is resolved by Track E's
  `typescript-eslint` minor bump (whose latest, 8.71.0, accepts `<6.1.0`). **Not fixed here on purpose:** it
  belongs to Track E's scope, and bumping ts-eslint now could surface new `recommended` rules mid-verification.
- **`ignoreDeprecations: "6.0"` in `src/main/tsconfig.json` is now dead config.** It was there to silence the
  `node10` deprecation that TS 7 has since removed (E15); TS 7 accepts it and it changes nothing. Left in
  place to keep the change minimal; a future config pass can drop it.
- **`dev:electron` is inconsistent with `package.json` `main`** — pre-existing, unrelated to TypeScript 7
  (Verification mode).
- **No version bump, tag or publish.** Track D is build tooling; the unreleased `staging` content stays a
  human decision.

## Delivery plan

`delivery_strategy: ask-on-risk` (the repo default). The authored change is a two-line dependency block in
`package.json` plus a possible minimal tsconfig adjustment; `pnpm-lock.yaml` is generated and excluded — far
under the ~400-line budget. **One feature branch (`feat/typescript-7`, off `staging` @ `568d7af`) and a single
PR to `staging`.** Push and PR remain the user's call.

## Progress

- 2026-10-03 — **Track D opened with the measured inventory; the shape was corrected before any write.** The
  plan called D "TypeScript 7 (native port — highest uncertainty)", implying a swap. Measurement showed a swap
  is impossible today: TS 7.0 ships no compiler API (E2) and `typescript-eslint` caps its peer below 6.1.0 (E3),
  so a direct bump would break `npm run lint`. The user chose the documented **side-by-side** path. Branch
  `feat/typescript-7` created off `staging` (`568d7af`, which carries Track C). No dependency had moved yet.
- 2026-10-03 — **D2–D5 complete; all gates green.** D2 wired the two compilers (`tsc` 7.0.2, `typescript`
  API 6.0.2) and regenerated the lockfile. D3 found and fixed the one real config break: TS 7 removed
  `moduleResolution: "node10"`, so `src/main/tsconfig.json` lost that single line and `build:electron` went
  from exit 2 (TS5108) to exit 0. D4 (read-only worker) returned **VERDICT PASS**: frozen-lockfile 0,
  `type-check` 0, `lint` 0, **196/196**, `build` 0, `build:electron` 0 + `node --check` 0; only the four
  expected paths changed. D5 was resolved by measurement rather than by a human: the dispatched bundle is built
  by Vite/Rolldown, not `tsc` (E8), and is byte-size-identical to Track C's (E16), so no smoke test could
  exercise the change. **Next: D6 — commit the work units, run the native review of the scoped candidate, then
  close.**
