# Vite 8 — Track C of the stack upgrade

## Objective

Move the build tooling to **Vite 8** (Rolldown bundler + Oxc transformer) — `vite` 8.3.2,
`@vitejs/plugin-react` 6.1.1 and `vite-plugin-electron-renderer` 1.0.0 — **without losing the 196-test
floor** Track F closed on, and **without breaking the Electron main/preload/renderer build** that the shipped
app depends on.

## Problem

The repo is on **Vite 7.2.6** (declared `^7.2.6`) while **8.3.2** is current. Track C is named in the
stack-upgrade plan as "Vite 8 / Rolldown + `@vitejs/plugin-react` 6" (`odd/tasks/react-19.md:433-435`). It
needs its own feature document, exactly as Tracks A, B and F did.

This is that document.

## Why now

1. **Track F unblocked it.** `vitest@4.0.18` declared `vite: ^6.0.0 || ^7.0.0`, so Vite 8 could not be
   installed alongside it. Track F moved the runner to `vitest@5.0.3`, which advertises
   `vite: ^6.4.0 || ^7.0.0 || ^8.0.0` — the sequencing decision recorded as pending after Track B merged
   ("Vitest 5 first, then Vite 8") is now satisfied, and `staging` carries Vitest 5 at `e3c6001`.
2. **It is the next toolchain track after A/B/F.** C is the bundler; D (TypeScript 7), E (ESLint 10) and
   G (React Compiler) remain separate documents.
3. **Risk is high, and the failure mode is the shipped Electron bundle — not the tests.** Unlike Track F,
   machine gates alone are not the whole instrument: Rolldown changes what `dist-electron/index.js` and
   `dist-vite/**` contain, so a human smoke test (launch the app, exercise the native `better-sqlite3` path)
   is required at the A6/B standard.

## The gap (measured 2026-10-03)

| Package | Have (installed) | Latest | Nature | Risk |
|---|---|---|---|---|
| `vite` | `7.2.6` | **`8.3.2`** | major (Rolldown + Oxc) | high |
| `@vitejs/plugin-react` | `5.1.1` | **`6.1.1`** | major, peer `vite ^8.0.0` | medium |
| `vite-plugin-electron-renderer` | `0.14.7` | **`1.0.0`** | major, Rolldown-native rewrite | medium |
| `vite-plugin-electron` | `1.1.2` | `1.1.2` | unchanged (already version-switches rollup/rolldown) | low |
| `@tailwindcss/vite` | `4.3.3` | `4.3.3` | unchanged (peer already includes `^8`) | low |
| Node | `22.17.0` | — | satisfies Vite 8 `^20.19.0 \|\| >=22.12.0` | low |
| `vitest` | `5.0.3` | `5.0.3` | unchanged (supports `vite ^8.0.0`) | low |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **Exact gap.** `vite` `7.2.6` → `8.3.2`; `@vitejs/plugin-react` `5.1.1` → `6.1.1`; `vite-plugin-electron-renderer` `0.14.7` → `1.0.0`. `vite-plugin-electron` stays `1.1.2`. | `npm view vite version` → `8.3.2`; `npm view @vitejs/plugin-react version` → `6.1.1`; `npm view vite-plugin-electron-renderer version` → `1.0.0`; `npm view vite-plugin-electron version` → `1.1.2`; `package.json:100,82,102,101` |
| E2 | **Node is not a blocker.** `vite@8.3.2` declares `engines.node: ^20.19.0 \|\| >=22.12.0`; installed Node is `v22.17.0`. | `npm view vite@8.3.2 engines`; `node -v` |
| E3 | **`@vitejs/plugin-react@6.1.1` requires only Vite 8.** Its only non-optional peer is `vite: ^8.0.0`; `oxc-transform-react`, `@rolldown/plugin-babel` and `babel-plugin-react-compiler` are **optional** peers. So `react()` works with no extra package. | `npm view @vitejs/plugin-react@6.1.1 peerDependencies peerDependenciesMeta` |
| E4 | **The old renderer blocker is gone in 1.0.0.** `vite-plugin-electron-renderer@0.14.7` imported `esbuild` (dist line 5) and wrote `config.build.rollupOptions` directly (dist lines 387-399, 454). `1.0.0` is a Rolldown-native rewrite: **no esbuild import**, and its config sites use `rolldownOptions` (dist `index.mjs:425,428`). Its `cjs-shim` reads `config.build.rolldownOptions?.output ?? config.build.rollupOptions.output` (dist `cjs-shim.mjs:18`). | `npm pack vite-plugin-electron-renderer@1.0.0` + grep over `package/dist`; grep over installed `node_modules/vite-plugin-electron-renderer/dist/index.mjs` |
| E5 | **`vite-plugin-electron@1.1.2` version-switches, but does not rescue a wrong key in *our* config.** It ships `compatRollupOptions` / `setBuildOptions`, which on Vite 8 deletes `build.rollupOptions` and keeps `build.rolldownOptions` (`node_modules/vite-plugin-electron/dist/utils-C8Fqt6Oj.mjs:38-66`). However `resolveViteConfigBase` merges the plugin defaults **first** and our `options.vite.build` **after** (`:122-127`), and `getBuildOptions` reads `rolldownOptions \|\| rollupOptions` (`:38-46`). With both keys present, the normalization keeps the defaults' `rolldownOptions` and **drops our `rollupOptions.external`** — so the external `better-sqlite3` can silently stop being external. Migrating our key to `rolldownOptions` is required, not cosmetic. | `node_modules/vite-plugin-electron/dist/utils-C8Fqt6Oj.mjs:36-66,118-136` |
| E6 | **Every `rollupOptions` site in our config.** `vite.config.ts:17` (`buildElectron` for main+preload), `:76` (dev renderer build) and `:99` (prod renderer build). The `external: ['electron','better-sqlite3']` at `:21` is the one E5 warns about. | `vite.config.ts:17,21,76,99` |
| E7 | **We never use the `esbuild` option.** No `esbuild:` key exists in `vite.config.ts` or `vitest.config.ts`, so the `esbuild` → `oxc` rename is a no-op for this repo. The only Vite transform-adjacent setting is `optimizeDeps.exclude: ['path']` (`:82,105`), whose semantics under Vite 8 must be observed, not assumed. | `vite.config.ts`, `vitest.config.ts`; `rg 'esbuild'` over both → 0 |
| E8 | **The real unknown: classic JSX under Oxc.** `tsconfig.json:17` sets `jsx: "react"` (classic), while Vite 8's Oxc transformer and `@vitejs/plugin-react@6` default to the automatic runtime. If Oxc honours the tsconfig `jsx` setting, JSX without an in-scope `React` binding can fail to compile or emit `React.createElement` against a missing global. This can only be settled by running the build, not by reading docs. | `tsconfig.json:17`; `.agents/skills/vite/references/rolldown-migration.md:74-88` |
| E9 | **The test runner already accepts Vite 8.** `vitest@5.0.3` peers `vite ^6.4.0 \|\| ^7.0.0 \|\| ^8.0.0`; installed Vitest 5 is the reward of Track F. | `odd/tasks/vitest-5.md`; `package.json:103` |
| E10 | **Lockfile is pnpm, and the install gate is `--frozen-lockfile`.** `pnpm` 10.28.2; only `pnpm-lock.yaml` exists (no `package-lock.json`/`yarn.lock`). Track F treated `pnpm install --frozen-lockfile` as a gate. | `Get-ChildItem -Name package-lock.json,pnpm-lock.yaml,yarn.lock`; `pnpm -v`; `odd/tasks/vitest-5.md:73` |

## Constraints

- **Node stays on 22.** E2 shows 22.17.0 satisfies Vite 8's engines. Do not bump `.node-version` or CI.
- **No version bump, tag, release or publish in this track.** Separate human decisions.
- **196 tests are the regression floor** (Track F's closing number). The suite must not go down.
- **The Electron build must keep working.** `better-sqlite3` must stay external and unpacked
  (`electron-builder.asarUnpack`), `src/main` must keep emitting a loadable `dist-electron/index.js`, and the
  renderer must load its assets with `base: './'` in production.
- **Track-scoped:** no TypeScript (D), ESLint (E), React Compiler (G) or Tailwind changes.
- Conventional commits, English artifacts, no AI attribution.

## Verification mode

- **TDD: not enabled** — unchanged from Tracks A, B and F. Ordinary functional verification.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run type-check`, `npm run lint`, `npm run build`,
  `pnpm install --frozen-lockfile`.
- **Extra gates for this track:** `npx vite build` must produce a loadable `dist-electron/index.js` and
  `dist-vite/**`; `npm run test:coverage` must exit 0 (proves Vitest 5 still loads under Vite 8); and a
  **human smoke test** — launch the Electron app, exercise a native `better-sqlite3` read/write path, and
  confirm the renderer renders (the Track A/B visual standard).

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `vite.config.ts`, and this document.

**Not authorized by this track:** any change under `src/renderer/**` or `src/main/**` (application code), any
other track's config or versions, and any version bump, tag or publish.

## Tasks — Track C

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| C1 | **Capture the baseline on the fork point** — `npm test`, `npm run type-check`, `npm run lint`, `npm run build`, `pnpm install --frozen-lockfile`, `npm run test:coverage` — and record the exact numbers as the regression floor | — | direct inline (one command batch) | [x] — **done 2026-10-03.** Baseline at `e3c6001`: `npm test` **196/196** across 21 files on `vitest 5.0.3`; `type-check`, `lint`, `build`, `frozen-lockfile`, `test:coverage` all exit 0. Build emits `dist-electron/index.js` **562.34 kB** + `preload.js` **7.43 kB** on Vite 7.2.6. Coverage headline unchanged from Track F: statements **40.57%**, branches **33.71%**, functions **40.26%**, lines **41.19%**. Floor fixed at **196**. |
| C2 | **Bump the three packages** (E1): `vite` `^8.3.2`, `@vitejs/plugin-react` `^6.1.1`, `vite-plugin-electron-renderer` `^1.0.0`; install and record resolved versions and any peer warnings | `package.json`, `pnpm-lock.yaml` | direct inline (a dependency edit; the audit removed the unknowns) | [x] — **done 2026-10-03.** `pnpm install` exit 0; resolved `vite` **8.3.2**, `@vitejs/plugin-react` **6.1.1**, `vite-plugin-electron-renderer` **1.0.0**. The only peer warnings are the **pre-existing** electron-builder↔squirrel mismatch (`app-builder-lib 26.15.3` vs `electron-builder-squirrel-windows 24.13.3`) — none from the upgraded packages (E3 confirmed: only `vite ^8` is a required peer). |
| C3 | **Migrate `vite.config.ts`**: rename every `rollupOptions` to `rolldownOptions` (E6), especially the `buildElectron` external list (E5); confirm no `esbuild` option exists (E7); settle the classic-JSX question (E8) by the build result alone, changing only config if needed | `vite.config.ts` | direct inline (already-understood edits) | [x] — **done 2026-10-03.** Renamed all three sites `vite.config.ts:17,76,99`; zero `rollupOptions` and zero `esbuild` remain (E6, E7). The `buildElectron` external list now lives under `rolldownOptions`, so the plugin's normalization no longer drops it (E5). **E8 settled by running: the build compiles the JSX with no React-in-scope error** — `plugin-react@6` + Oxc handled the classic `jsx: "react"` tsconfig without any config change. |
| C4 | **Prove the Electron + renderer build under Rolldown**: `npm run build` → verify `dist-vite/**` with `base: './'`; `npx vite build` → verify `dist-electron/index.js` loads, `__dirname`/CJS interop survive, and `better-sqlite3` stays external/unbundled | `dist-electron/**`, `dist-vite/**` | per-action worker | [x] — **done 2026-10-03.** `npm run build` exit 0 on **vite 8.3.2**: renderer → `dist-vite/index.html` + `assets/index-CRbiQ0wJ.css` (83.39 kB) + `assets/index-BB_QvrXf.js` (964.39 kB), and `index.html` keeps `./assets/…` (base `./` preserved); main → `dist-electron/index.js` **547,011 B**, preload → `dist-electron/preload.js` **7,396 B**. `better-sqlite3` appears **once** as an external `require`, `electron` is externalized, and `node --check dist-electron/index.js` exits 0 (valid CJS — `__dirname`/interop intact). |
| C5 | **Verify:** suite (≥196), `type-check`, `lint`, `build`, `pnpm install --frozen-lockfile`, `test:coverage`; plus the human smoke test (launch the app, exercise `better-sqlite3`, confirm the renderer) | — | per-action workers + human | machine gates **done 2026-10-03** — `npm test` **196/196** (21 files) on vitest 5.0.3 / Vite 8.3.2; `type-check`, `lint`, `build`, `frozen-lockfile`, `test:coverage` all exit 0; coverage headline identical to baseline (statements **40.57%**, branches **33.71%**, functions **40.26%**, lines **41.19%**). **Human smoke test PASSED 2026-10-03** — the user launched the app and confirmed it renders correctly and a native `better-sqlite3`-backed operation works. |
| C6 | **Record results, evidence and residue here**, then close the track | this document | direct inline | [ ] |

## Acceptance criteria

- `vite` 8.x, `@vitejs/plugin-react` 6.x and `vite-plugin-electron-renderer` 1.x are installed (E1).
- **At least 196 tests pass**, and `type-check`, `lint`, `build` are clean.
- `pnpm install --frozen-lockfile` exits 0 and `npm run test:coverage` exits 0.
- **The Electron app launches and its native `better-sqlite3` path works**, and the renderer renders — proven,
  not assumed.
- **Zero authored changes under `src/renderer/**` or `src/main/**`.**
- Anything the upgrade cannot fix within this track is recorded as a finding, not quietly left.

## Residue

- **New WARNING from Vite 8's config loader (informational, non-blocking):** `vite.config.ts:1:1` and
  `vitest.config.ts:1:1` are warned as "ESM syntax in a file loaded as CommonJS", unsupported by the planned
  `configLoader: 'native'` default in a future major. Fixable later with a `.mts` extension or
  `"type": "module"`; it does not fail builds today. Recorded so a future track does not mistake it for v8
  fallout from this migration.
- **The renderer bundle grew** from a >500 kB chunk (already flagged in Track F) to **964.39 kB**
  (`dist-vite/assets/index-BB_QvrXf.js`). Rolldown minifies/chunks differently; there is no functional
  regression (suite green, build loads), but a code-splitting pass is now more warranted. Not in this track's
  scope.
- **The old `Unknown input options: platform` Rollup warning is gone** under Rolldown — an improvement, not
  residue. The pre-existing `apiService.ts` dynamic-and-static import warning persists, now phrased as
  `INEFFECTIVE_DYNAMIC_IMPORT`.
- **`node --check` proves syntax, not runtime.** The true Electron/native path is the human smoke test (C5),
  which remains outstanding at the time of this record.
- **No version bump, tag or publish.** Content on `staging` since `v1.10.0` remains unreleased; that stays a
  human decision.

## Delivery plan

`delivery_strategy: ask-on-risk` (the repo default). The forecast is well under the ~400 authored-line
heuristic: the authored change is a dependency block in `package.json` plus a key rename in `vite.config.ts`;
`pnpm-lock.yaml` is generated and excluded. **One feature branch (`feat/vite-8`, off `staging`) and a single PR
to `staging`.** Push and PR remain the user's call.

## Progress

- 2026-10-03 — **Track C opened with the measured inventory.** Branch `feat/vite-8` created off `staging`
  (`e3c6001`, which carries Track F's Vitest 5). No dependency has moved yet. The audit settled the two
  unknowns from the pre-F inventory: the renderer plugin's esbuild blocker is gone in 1.0.0 (E4), and
  `vite-plugin-electron@1.1.2` normalizes keys but cannot rescue a wrong key in our own config (E5). The
  remaining live risks are the classic-JSX question (E8) and the Electron bundle/Rolldown output, both
  settled by running, not reading. Next: **C1** (baseline).
- 2026-10-03 — **C1–C4 executed.** Baseline at `e3c6001`: **196/196**, all gates 0. C2 moved the three
  packages (`vite 8.3.2`, `plugin-react 6.1.1`, `renderer 1.0.0`). C3 renamed the three `rollupOptions` keys to
  `rolldownOptions`; the build then compiled the JSX **without the classic-JSX failure E8 feared**, so no
  config change was needed for it. C4 proved the build: `dist-vite/**` with `base: './'` and
  `dist-electron/index.js` **547,011 B** + `preload.js` **7,396 B**, `better-sqlite3` still one external
  `require`, and `node --check` clean. C5 machine gates are all green on Vite 8 (suite **196/196**, type-check
  / lint / build / frozen-lockfile / coverage exit 0, coverage headline unchanged). **The human smoke test
  PASSED 2026-10-03** — the user launched the app and confirmed the renderer renders and a native
  `better-sqlite3`-backed operation works. C1–C5 complete. Next: native review of this candidate under RDD,
  then C6 close and the human's push/PR decision.
