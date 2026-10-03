# Tailwind 4 — Track B of the stack upgrade

## Objective

Move the app to **Tailwind CSS 4** (`tailwindcss` 4.3.3) — the v4 engine, the Vite plugin, and the
`tw-animate-css` replacement for `tailwindcss-animate` — without losing any of the **194 passing tests**,
and with a **larger human smoke-test surface than Track A's**, because every failure mode in this track is
visual.

## Problem

The repo is on **Tailwind 3.4.18** while **4.3.3** is current. The upgrade has been deferred twice as "a
separate track", and Track A's own document named it as the next one:

- `odd/tasks/performance-fase-0-1.md:37-38` — *"Out of scope: Fase 2..6, all dependency upgrades (Electron
  44, React 19 + Compiler, **Tailwind 4**, Vite 8, TS 7). Each gets its own feature document."*
- `odd/tasks/electron-30-to-44.md:20` — *"Out: React 19, **Tailwind 4**, Vite 8, TypeScript 7. Those are
  separate tracks."*
- `odd/tasks/react-19.md` — the track order lists **B = Tailwind 4** and states it "needs its own feature
  document opened exactly as this one was".

This is that document.

## Why

1. **It is the next track in the agreed order**, and the only one already unblocked: Track A is done and
   delivered, and B depends on nothing that A did not finish.
2. **It is independent of app logic.** Nothing in `src/**` changes *behaviour*; the failure mode is
   rendering. That makes it verifiable in isolation — but it also means **the test suite cannot be the
   instrument that proves it**, which is exactly the trap Track A's F8 recorded.
3. **The inventory found two latent config defects that v4 forces into the open** (E1, E3). They have been
   silent in v3 and cannot stay silent through the migration — so this track's first decision is a product
   decision, not a mechanical one.

## The gap (measured 2026-09-28)

| Package | Have (installed) | Latest | Nature | Risk |
|---|---|---|---|---|
| `tailwindcss` | `3.4.18` | **4.3.3** | major, new engine | **high** |
| `@tailwindcss/vite` | *not installed* | **4.3.3** | new build integration | medium |
| `tailwindcss-animate` | `1.0.7` (in `dependencies`) | — | **cannot survive v4** (peer `>=3.0.0 \|\| insiders`) → `tw-animate-css` **1.4.0** | medium |
| `autoprefixer` | `10.4.22` | `10.6.1` | **not needed by v4** | low |
| `postcss` | `8.5.6` | — | v4 moves the PostCSS plugin out of the core package (`@tailwindcss/postcss`) | medium |
| Node | `22.17.0` | — | satisfies every target (E11) | low |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **Every `dark:` utility in this app is dead CSS today, and that is measured, not inferred.** `tailwind.config.js:6` sets `darkMode: ['class', 'class']`. The second element of that array is consumed verbatim as the selector, so each dark variant compiles to `:is(class *)` — a selector for an element literally named `class`, which matches nothing. **Scope: 67 `dark:` occurrences across 13 files**, all of them status colours (`dark:text-amber-400` ×11, `dark:text-emerald-400` ×9, `dark:text-green-400` ×7, …). What theming *does* work (`.dark { --background: … }`) comes from the CSS variables in `index.css`, **not** from the variant. | Generated the stylesheet with the repo's own config — `npx tailwindcss -c tailwind.config.js -i src/renderer/index.css` → `64,710` bytes — and grepped it: `.dark\:border-amber-700:is(class *){…}`, plus 39 working `.dark ` rules that come from `index.css` (`.dark .flatpickr-calendar` etc.). Counts: `rg -o "dark:[a-zA-Z0-9_\-\[\]%\./]+" src` = 67 occurrences, `rg -l "dark:" src` = 13 files |
| E2 | **v4 cannot accidentally preserve E1, because v4's default dark variant is the media query, not the class.** The official guide states the default uses `prefers-color-scheme`, and that class-based dark mode must be declared explicitly: `@custom-variant dark (&:where(.dark, .dark *));`. **Consequence: wiring it correctly activates all 67 utilities for the first time** — a visible change (probably a fix, but a change) that no machine gate can see. | Tailwind official docs, `src/docs/dark-mode.mdx` (via Context7, `/tailwindlabs/tailwindcss.com`), 2026-09-28 |
| E3 | **The Inter font stack in the config has never been active either.** `tailwind.config.js:60-65` nests `fontFamily: { sans: ['Inter', …] }` inside a top-level `variants` key — a v2-era key that v3 removed and ignores, so it sits **outside `theme`** and generates nothing. Measured: **0** `font-sans` occurrences in `src/**`; **no** `font-family` declaration in `index.css`; `.font-sans` absent from the generated stylesheet; `Inter` appears in that stylesheet only as the Google Fonts `@import` (`index.css:1`) passing through. So the webfont is fetched and never applied. | `tailwind.config.js:60-65`; `rg -c "font-sans" src` = 0; `rg "font-family" src/renderer/index.css` = 0 hits; grep of the generated CSS |
| E4 | **The build integration is PostCSS, and v4 splits that package.** `postcss.config.js:3-4` runs `tailwindcss` + `autoprefixer`; `vite.config.ts` wires **no** Tailwind plugin (its plugins are `react()`, `vite-plugin-electron`, `vite-plugin-electron-renderer`). v4 removes the PostCSS plugin from the core package (`@tailwindcss/postcss`) and ships `@tailwindcss/vite`. Installed `vite` 7.2.6 satisfies `@tailwindcss/vite@4.3.3`'s peer range. | `postcss.config.js`, `vite.config.ts`; `pnpm view @tailwindcss/vite peerDependencies` → `{ vite: '^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8' }`; `node_modules/vite/package.json` → `7.2.6` |
| E5 | **The CSS entry is a v3 shape with the shadcn token layer on top.** `src/renderer/index.css`: Google Fonts `@import` (:1), the three `@tailwind` directives (:2-4), **two** `@layer base` blocks (:16-77, :81-88), **4** `@apply` (:18, :22, :83, :86), shadcn tokens as **bare HSL triplets without the `hsl()` wrapper** (`--background: 0 0% 100%`, :24-50), `.dark` overrides (:51-76), and flatpickr overrides (:90-199). Imported once, at `src/renderer/main.tsx:3`. | `src/renderer/index.css`; `components.json` `tailwind.css: "src/renderer/index.css"` |
| E6 | **The token layer maps 1:1 onto `@theme inline`.** The 20 shadcn colour tokens in `tailwind.config.js:12-51` are `hsl(var(--token))` wrappers — precisely the case the official guide documents for `@theme inline` (theme values that reference runtime CSS variables). So this migration is a **token port**, not a component rewrite. | Tailwind official docs, `src/docs/colors.mdx` `@theme inline` example (via Context7), 2026-09-28; `tailwind.config.js:12-51` |
| E7 | **Source scale.** `59` `.tsx` files under `src/**`, of which **51 use Tailwind classes**. Dynamic class construction in **17 files** (`cn`/`cva`: `lib/utils.ts`, `NavBar`, `WorkTimeForm`, and 14 `ui/*` files), plus template-literal `className` in ≥20 more. **78 lines** use bracket syntax (arbitrary values and arbitrary variants). `components.json` points `tailwind.config` at `tailwind.config.js`. | `glob`/`grep` over `src/**`; `src/renderer/components/ui/*` |
| E8 | **The class-level rename surface, counted, because v4 changes what these mean.** `outline-none` **41 lines**, `ring-1` **26** / `ring-2` **4** (no bare `ring`), `shadow-sm` **17** / bare `shadow` **4**, `rounded-sm` **6** / bare `rounded` **13**, `blur-sm` **1** / bare `blur` **1**. Verified changes: v4's `ring` default is **1px `currentColor`** (was 3px blue) and the shadow scale shifts (`shadow-sm`→`shadow-xs`, bare `shadow`→`shadow-sm`). **Every site above either gets renamed or changes its rendered output.** | Counts are grep *line* matches over `src/**`; Tailwind official upgrade guide, `src/docs/upgrade-guide.mdx` (via Context7), 2026-09-28 |
| E9 | **The "removed deprecated utilities" list does not touch this codebase — zeros are findings.** 0 hits across `src/**` for `bg-opacity-`, `text-opacity-`, `border-opacity-`, `divide-opacity-`, `placeholder-opacity-`, `flex-shrink-`, `flex-grow-`, `overflow-ellipsis`, `decoration-slice`, `decoration-clone`, `@screen`, `theme(`. The codebase already uses the modern forms (`shrink-0`, `flex-1`). | `rg` per token over `src/**` |
| E10 | **`tailwindcss-animate` is in use and is the one dependency that cannot cross.** **10 lines across 7 files**: `WorkTimeForm.tsx:977` and `ui/{alert-dialog,combobox,dialog,dropdown-menu,select,tooltip}.tsx`, using `animate-in`/`animate-out`, `fade-in-0`/`out-0`, `zoom-in-95`/`out-95`, `slide-in-from-*`, `slide-out-to-*`. Its peer is `tailwindcss: ">=3.0.0 \|\| insiders"` — a v3 plugin. `tw-animate-css` **1.4.0** is the v4 replacement. It also sits in `dependencies` where it belongs in `devDependencies`. | `pnpm view tailwindcss-animate peerDependencies`; `pnpm view tw-animate-css version` → `1.4.0`; `package.json:70`; grep over `src/**` |
| E11 | **The toolchain needs no bump.** `node -v` = **v22.17.0**; `.node-version` = `22`; `package.json` declares no `engines`; `tailwindcss@4.3.3` publishes no `engines` field; `@tailwindcss/vite@4.3.3` peers `vite ^5.2.0 \|\| ^6 \|\| ^7 \|\| ^8` against the installed `7.2.6`. Registry: `tailwindcss` dist-tags `{ latest: 4.3.3, 'v3-lts': 3.4.19, next: 4.0.0, insiders }`. | `node -v`; `pnpm view tailwindcss version` / `dist-tags`; `pnpm view @tailwindcss/vite version`; `node_modules/{tailwindcss,vite}/package.json` |
| E12 | **v4 config is CSS-first, with a JS-config escape hatch.** `@import "tailwindcss"` replaces the three `@tailwind` directives; tokens move into `@theme` / `@theme inline`; `@config` remains available for a JS config. The Vite path is `@tailwindcss/vite` in `vite.config.ts` plus that one import. | Tailwind official upgrade guide and v4 announcement (via Context7), 2026-09-28 |

## Constraints

- **Node stays on 22.** E11 shows it satisfies every target. Do not bump `.node-version` or CI.
- **No version bump, tag, release or publish in this track.** Those stay separate human decisions.
- **194 tests are the regression floor** (the number Track A closed on).
- **One track per commit series.** A track that leaves the suite red is not a track; it is a revert.
- **Track-scoped:** no React, Vite, TypeScript, ESLint or Vitest version changes (tracks C–F, each with its
  own document).
- Conventional commits, English artifacts, no AI attribution.

## Verification mode

- **TDD: not enabled** — unchanged from Track A's finding. Ordinary functional verification.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Mandatory extra gate — and a bigger one than Track A's: a human smoke test of the packaged app, plus a
  visual before/after comparison.** Machine gates cannot see any of this track's failure modes (E1, E2, E8,
  E10). The specific surfaces to compare are: the **67 `dark:` status colours** (they change state the
  first time the variant is wired correctly), **shadows / rings / rounded / blur** (E8), the **7 animated
  component files** (E10), and the **flatpickr overrides** at `index.css:90-199`, which depend on
  Tailwind's preflight and are the highest-risk CSS in the repo.
- **A visual baseline must exist before the version bump**, so "it looks the same" is a comparison rather
  than a memory.

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `src/**` (CSS and components), the config files this track forces
(`tailwind.config.js`, `postcss.config.js`, `vite.config.ts`), and this document.

**Not authorized by this track:** React, Vite, TypeScript, ESLint and Vitest config or version changes
(tracks C–F), and any version bump, tag or publish.

## Tasks — Track B

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| B1 | **Settle the E1/E2 disposition before any bump:** wiring `@custom-variant dark` correctly activates 67 utilities that have never rendered. Fix them into effect, or preserve the current look | — | orchestrator + user (product decision) | [x] — **decided 2026-09-28: fix it.** The user's call: *"arreglemos lo que sea necesario para que todo funcione como debería funcionar"*. The dark variant gets wired the documented way and the 67 utilities start applying. The smoke test must therefore compare the status colours **in dark mode** explicitly (see Verification mode) — this is an intended change, not a regression, and the only way to tell them apart is to have looked first. |
| B2 | Choose the integration path: `@tailwindcss/vite` + `@import "tailwindcss"` (recommended, E4/E12) or `@tailwindcss/postcss` keeping the PostCSS pipeline | `vite.config.ts`, `postcss.config.js`, `package.json`, `src/renderer/index.css`, `tailwind.config.js` | delegated (one writer) | [x] — **done 2026-10-02, commit `8be00df`.** Chose `@tailwindcss/vite` + `@import "tailwindcss"` (E4/E12), bridging the legacy JS config through `@config`. `postcss.config.js` deleted (v4 no longer ships the PostCSS plugin in core), `autoprefixer` dropped, `tailwindcss-animate` kept for B4. `@custom-variant dark (&:where(.dark, .dark *))` added and the dead `darkMode: ['class','class']` line removed — this lands **B1's wiring**. All gates green: frozen-lockfile, `npm test` **196 passed** (floor 194), `type-check`, `lint`, `build`. Built CSS: `prefers-color-scheme` **0** vs `:where(.dark` **37** and `.dark\:` **35**. |
| B3 | Port the token layer to `@theme inline`: the 20 shadcn colours (E6), `borderRadius` (`:53-57`), and the Inter stack that E3 shows has never applied | `src/renderer/index.css`, `tailwind.config.js` | delegated (one writer) | [x] — **done 2026-10-02.** Static tokens (`slate-800/900`, `--font-sans`) live in a plain `@theme`; the shadcn colour layer, `chart-1..5` and `radius-lg/md/sm` live in `@theme inline` because they reference the runtime `var(--token)` triplets. `tailwind.config.js` is reduced to `content` + the `tailwindcss-animate` plugin — the `theme` object and the dead `variants`/`fontFamily` key are gone, and the `@config` bridge stays until B4. **Intended visible change:** `--font-sans` now feeds v4 preflight's `--default-font-family`, so the Inter stack that E3 proved never applied is active — the B6 smoke test must compare the app font. Green: `npm test` **196 passed** (floor 194), `type-check`, `lint`, `build`. Built CSS `dist-vite/assets/index-eiKI4LPz.css` (84.31 kB): `hsl(var(--background))` ×11, `:where(.dark` ×37, and the `--font-sans:"Inter", …` → `--default-font-family:var(--font-sans)` chain present. |
| B4 | Replace `tailwindcss-animate` with `tw-animate-css` and re-verify the 10 animation lines in 7 files (E10) | `package.json`, CSS entry, 7 component files | delegated (one writer) | [ ] |
| B5 | Apply the E8 class-level renames, after confirming the full rename table against the upgrade guide | `src/**` | delegated (one writer) | [ ] |
| B6 | Verify: suite, `type-check`, `lint`, `build`, the visual comparison against B1's baseline, and the human smoke test — plus a cheap build-output assertion that the generated stylesheet contains the token layer and the class-bound dark variant (review finding `R3-no-build-output-assertion`) | — | per-action workers | [ ] |
| B7 | Record results, evidence and residue here | this document | direct inline | [ ] |

Task detail for B3–B5 is deliberately deferred to B1's outcome: the token port's shape depends on whether
the dark variant is wired correctly.

## Acceptance criteria

- `tailwindcss` is on 4.x; `autoprefixer` and `tailwindcss-animate` are gone; `tw-animate-css` is present.
- **All 194 tests pass**, and `type-check`, `lint` and `build` are clean.
- The visual comparison (human) shows **only intended changes** — every unintended difference is either
  fixed or recorded.
- `pnpm install --frozen-lockfile` succeeds, so CI's install path is not broken.
- Anything the upgrade cannot fix within this track is recorded as a finding, not quietly left.

## Open questions

1. ~~**E1/E2** — fix the dark variant or preserve today's look?~~ **Resolved 2026-09-28: fix it** (B1). The 67 utilities will start applying; the visual comparison is what proves the result is the intended one rather than a regression.
2. **The full rename table** — the upgrade guide renames the `*-sm` end of the shadow scale (verified). The
   equivalents for `rounded-sm` (**6**), `blur-sm` (**1**) and `outline-none` (**41**) must be read off the
   guide's table before those sites are touched. Currently **UNVERIFIED by this document**.
3. **Keep the JS config or go fully CSS-first?** `@config` exists as an escape hatch (E12), so both are
   viable; the recommendation is to port the tokens and then delete `tailwind.config.js`.

## Delivery plan (not yet decided)

`delivery_strategy: ask-on-risk` (the repo default). No slice decision is due yet: the changed-line forecast
does not exist until B3–B5 are scoped. Re-evaluate after they are.

**Adjacent and still open, but not part of this track:** the content merged into `main` since the last tag
(`v1.10.0`; the diff is 16 files, **+2293 −804**) is **unreleased**. It carries the silent updater, the
React 19 major and the flatpickr 4 rewrite. Whether `1.11.0` ships before or after this track is a separate
human decision, and nothing in this document depends on it.

## Progress

- 2026-09-28 — **Track B opened with the measured inventory.** No file outside this document has been
  touched, and no dependency has moved. The opening produced two findings that did not exist in any prior
  document: **E1** (67 `dark:` utilities compile to `:is(class *)` and have never applied — proven by
  generating the stylesheet with the repo's own config and grepping it) and **E3** (the Inter font stack
  sits under a v2-era `variants` key, so it has never generated anything). B1 was created to settle E1/E2
  before any version bump, because a correct v4 dark variant would activate those 67 utilities for the
  first time — a visual change no machine gate can see.
- 2026-09-28 — **B1 decided: fix it.** The user chose to wire the dark variant correctly, accepting that the
  67 `dark:` utilities start applying for the first time (E1/E2). Recorded in this form on purpose: the
  intended dark-mode colours appearing and a regression are **indistinguishable without a before/after
  comparison**, so the smoke test is the only instrument that tells them apart. No dependency has moved and
  no version has been bumped; the next task is **B2** (integration path).
- 2026-10-02 — **B2 done (commit `8be00df`): the engine moved to the v4 Vite plugin.** Chose
  `@tailwindcss/vite` + `@import "tailwindcss"` over keeping PostCSS (E4/E12). The legacy
  `tailwind.config.js` is bridged with `@config` for this step, `postcss.config.js` is deleted and
  `autoprefixer` dropped, and the dark variant is now class-based: `@custom-variant dark
  (&:where(.dark, .dark *))` replaced the dead `darkMode: ['class','class']` — so **B1's wiring landed
  here**. Green: frozen-lockfile install, **196 tests passed** (floor 194), `type-check`, `lint`,
  `build`. An independent check of the built stylesheet shows `prefers-color-scheme` **0**,
  `:where(.dark` **37**, `.dark\:` **35**, `.bg-background` **5** — the variant is bound to the `.dark`
  class, not the media query. `pnpm` reported the known local install drift and rebuilt ~60 packages
  from `.ignored`; the `MODULE_TYPELESS_PACKAGE_JSON` warning from the ESM-looking `tailwind.config.js`
  is benign. Next: **B3** (port the tokens to `@theme inline`).
- 2026-10-02 — **B2 reviewed and approved** (lineage `review-0c65487840411dd9`, lens `review-reliability`,
  tier medium, candidate `c221ec2..d1c27e5`, 7 paths / 991 changed lines), **authority burned**. The
  consolidated review returned **4 advisory (non-blocking) findings** and opened no correction:
  (a) `R3-dark-variant-activation` — the dark variant now renders but has no automated assertion;
  (b) `R3-v4-utility-default-shift` — v4's ring/shadow/rounded/blur/outline defaults render differently
  until B5 renames them; (c) `R3-legacy-plugin-bridge` — `tailwindcss-animate` is still loaded through the
  legacy `@config` bridge until B4; (d) `R3-no-build-output-assertion` — a cheap generated-CSS assertion
  would prove the result at a lower cost than the B6 smoke test (now folded into B6). (a)–(c) are the
  track's own planned work; none is a reason to re-run the review on this candidate.
- 2026-10-02 — **B3 done: the token layer is CSS-first.** Ported `theme.extend` out of
  `tailwind.config.js` into `@theme` (static: `slate-800/900`, `--font-sans`) and `@theme inline`
  (runtime-referencing: the shadcn colours, `chart-1..5`, `radius-lg/md/sm`) in
  `src/renderer/index.css`. The JS config now holds only `content` and the `tailwindcss-animate`
  plugin, so the `@config` bridge survives for one more task. Two intended effects worth watching in
  B6: (a) the Inter stack is now genuinely applied through v4 preflight's `--default-font-family`
  (E3), a font change on every screen; (b) `slate-800/900` now come from the ported theme (v4's own
  defaults were the same colours via `oklch`, so no visible difference). Gates green: `npm test`
  **196 passed**, `type-check`, `lint`, `build`. The worker flagged that the B6 assertion wording
  ("`Inter` inside a `font-family` declaration") does not match v4's actual emission — v4 emits
  `--font-sans:"Inter", …` + `--default-font-family:var(--font-sans)` + `html{font-family:var(--default-font-family,…)}`
  instead of a literal `font-family: Inter`; assert the variable chain, not a literal. Next: **B4**
  (`tw-animate-css` replaces `tailwindcss-animate`, and the JS config/`@config` bridge can then go).
