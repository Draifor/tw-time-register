# React 19 — Track A of the stack upgrade

## Objective

Move the app to **React 19** and then, in ordered and independently-verifiable tracks, to the current
versions of the rest of the stack — without losing any of the 183 passing tests, and verifying each
track before the next one starts.

## Problem

The repo is on **React 18.3.1** while `19.3.0` is current. The upgrade has been deferred twice as "a
separate track", but no document was ever opened for it:

- `odd/tasks/performance-fase-0-1.md:37-38` — *"Out of scope: Fase 2..6, all dependency upgrades
  (Electron 44, **React 19 + Compiler**, Tailwind 4, Vite 8, TS 7). Each gets its own feature document."*
- `odd/tasks/electron-30-to-44.md:20` — *"Out: React 19, Tailwind 4, Vite 8, TypeScript 7. Those are
  separate tracks."*

So the deferral was recorded; the document it promised was not. This is it.

## Why

1. **The user asked for it directly**: bring React up so the whole stack is current, and do whatever is
   needed for the app to work at its best.
2. **It unblocks a real decision.** Performance Fase 2 (re-renders) is largely *memoization* work —
   `React.memo`, `useMemo` — which the React Compiler is explicitly designed to make unnecessary. Doing
   Fase 2 by hand and *then* adding the compiler risks writing code the compiler renders redundant, and
   manual memo with incomplete dependencies can actively **block** the compiler
   (`preserve-manual-memoization`). Upgrading React first turns that guessing into a measured decision.
3. **The upgrade is cheaper now than it will be later.** See E3: the codebase is already free of every
   legacy React API that makes 19 painful.

## The gap (measured 2026-09-27)

| Track | Package | Have | Latest | Nature | Risk |
|---|---|---|---|---|---|
| **A** | `react` / `react-dom` | `^18.3.1` | **19.3.0** | major | **low/medium** (see E1, E3) |
| **A** | `@types/react` / `@types/react-dom` | `^18.3.23` / `^18.3.7` | **19.3.0** | major | medium (type-level only) |
| **A** | `react-flatpickr` | `^3.10.13` | **4.0.11** | major | **unknown — the real risk** |
| **A** | `react-router-dom` | `^6.30.2` | **7.x** | major | medium |
| **A** | `i18next` / `react-i18next` | `^23.11.5` / `^14.1.2` | **26.x** / **17.0.15** | major, **coupled** | medium |
| **A** | `react-hook-form`, `@tanstack/react-query`, Radix, `lucide-react`, `sonner`, `axios`, `date-fns` | various | minor bumps | minor | low |
| **B** | `tailwindcss` (+ `autoprefixer`, `tailwindcss-animate`) | `^3.4.18` | **4.3.3** | major, new engine | **high** |
| **C** | `vite` / `@vitejs/plugin-react` | `^7.2.6` / `^5.1.1` | **8.3.1** / **6.1.1** | major (Rolldown) | medium/high |
| **D** | `typescript` | `^5.8.3` | **7.0.2** | major (native port) | **high** |
| **E** | `eslint` / `typescript-eslint` | `9.39.1` / `^8.48.1` | **10.11.0** / **8.70.1** | eslint is a major; typescript-eslint is a **minor** inside 8 | medium |
| **F** | `vitest` (+ coverage, ui) | `^4.0.18` | **5.0.2** | major | medium |
| **G** | React Compiler | — | `babel-plugin-react-compiler` **1.0.0** | new build step | unknown — needs the spike |

## Evidence — measured, not assumed

| # | Claim | Evidence |
|---|---|---|
| E1 | **11 of the 12 renderer dependencies already declare React 19 support. `react-flatpickr` is the exception — and this document's first draft got that wrong.** The draft quoted `react: ">= 16 <= 19"` as if it described the **installed** package. That range is the **latest** release's (4.0.11). The installed `3.10.13` declares `react: ">=16, <=18"`, which **excludes React 19**. Cause of the error: `pnpm view <pkg> peerDependencies` returns the *latest* version, and the result was written down as if it described the installed one. | Clean peers: `sonner` `^18 \|\| ^19`; `lucide-react` `^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19`; `react-router-dom@6.30.2` `>=16.8`; `@testing-library/react` `^18 \|\| ^19`; `react-hook-form` `^16.8 \|\| ^17 \|\| ^18 \|\| ^19`; Radix `^16.8 \|\| ... \|\| ^19`; `@tanstack/react-table >=18`; `@tanstack/react-query` `^18 \|\| ^19`; `react-i18next@14.1.3` `>= 16.8.0`. Exception: `node_modules/react-flatpickr/package.json:3` `"version": "3.10.13"` and `:68-70` `"peerDependencies": { "react": ">=16, <=18" }`, resolved in `pnpm-lock.yaml:82` as `3.10.13(react@18.3.1)` |
| E2 | **Node does not need to be bumped.** Every tool target is satisfied by the installed **22.17.0**. | `vite@8` → `^20.19.0 \|\| >=22.12.0`; `vitest@5` → `^22.12.0 \|\| ^24 \|\| >=26`; `eslint@10` → `^20.19.0 \|\| ^22.13.0 \|\| >=24`; `@vitejs/plugin-react@6` → `^20.19.0 \|\| >=22.12.0`; `typescript@7` → `>=16.20.0`. Installed `node -v` = `v22.17.0`, `.node-version` = `22` |
| E3 | **The codebase is already clean of every legacy React API that makes 19 painful.** | `rg` over `src/**`: `createRoot` at `src/renderer/main.tsx:7`; **0** hits for `findDOMNode`, `unmountComponentAtNode`, `hydrateRoot`, `.defaultProps`, `propTypes`, `childContextTypes`, `React.FC`, bare `useRef()`, `JSX.Element` |
| E4 | **47 `forwardRef` occurrences exist, and they are a cleanup opportunity — not a blocker.** `forwardRef` still works in React 19; passing `ref` as a prop is the new preference and the deprecation is not a removal. | `rg -o forwardRef src` = 47 |
| E5 | **`react-flatpickr` is not a runtime hazard — it is a peer-range hazard, plus a rewrite in v4.** The installed `3.10.13` uses **none** of the APIs React 19 removed: the DOM node comes from a **callback ref**, not `findDOMNode` (`lib/index.js:162`, `:133-139`); lifecycles are only `componentDidMount`/`componentDidUpdate`/`componentWillUnmount` (`:97`, `:56`, `:101`); `defaultProps` is *static on a class* (`:52-54`), which React 19 still honours; `propTypes` (`:28`) is silently ignored. So it runs on React 19 — it just **declares** that it does not support it. v4.0.11 is a full rewrite to a hooks function component with ESM output that bundles its own types, and it changes the ref API to `DateTimePickerHandle` (v4.0.4) — which does **not** affect this app, since all three call sites pass no ref. | `node_modules/react-flatpickr/{package.json,lib/index.js}`; v4 registry metadata and release notes; the repo's three call sites: `src/renderer/components/ui/input-date.tsx:52-63`, `input-time.tsx:26-32`, `time-picker.tsx:39-59` (props used: `value`, `onChange`, `className`, `options`, `placeholder`, `disabled` — no ref, no instance access) |
| E6 | **`tailwindcss-animate` cannot survive Tailwind 4.** Its peer is `tailwindcss: ">=3.0.0 \|\| insiders"` — a v3 plugin; Tailwind 4 needs `tw-animate-css`. | `pnpm view tailwindcss-animate peerDependencies` |
| E7 | **`react-i18next` 17 is coupled to i18next.** Its peer requires `i18next >= 26.2.0` while this repo has `^23.11.5`, so the two must move together. | `pnpm view react-i18next@17 peerDependencies` |
| E8 | **Two stale dependency-hygiene items** found while inventorying: `@types/react-router-dom@^5.3.3` (react-router-dom 6+ ships its own types, so this is a v5-era leftover) and `@types/babel__core@^7.20.5` sitting in `dependencies` rather than `devDependencies`. | `package.json` dependency blocks |
| E9 | **Late corrections to this document's own first draft**, made by re-querying instead of trusting recall: `typescript-eslint` latest is **8.70.1**, i.e. a *minor* bump inside 8 — **not** the "9.x major" the first draft of the gap table claimed. The React Compiler is at **1.0.0**, a real release rather than a release candidate. `react-router-dom` latest is **7.18.4**. The Tailwind 4 replacements exist: `tw-animate-css@1.4.0` and `@tailwindcss/vite@4.3.3`. | `pnpm view <pkg> version`, 2026-09-27 |
| E10 | **The rest of React 19's surface is a non-event for this app**, confirmed by the A1 audit. Absent everywhere in `src/**`: string refs, `createFactory`, `React.Children`, `element.ref`/`props.ref` access, bare `useRef()`, `defaultProps` on function components, runtime `propTypes`, `react-dom/test-utils` imports, and any app-level `createContext`. The only `ReactDOM` use is `createRoot`. | `rg` across `src/**` per the A1 audit |
| E11 | **Testing is safe, with one masked type-level caveat.** `@testing-library/react@16.3.2` allows React 19 and its `act-compat` prefers `React.act`, falling back to the deprecated shim only if needed. And `react-dom/test-utils` **still exists in React 19.3.0** as a deprecated shim, so the common claim that it was removed is wrong for this version. Caveat: RTL's own types still import that subpath while `@types/react-dom@19` drops it — invisible here only because `tsconfig.json:7` sets `skipLibCheck: true`. | `node_modules/@testing-library/react/{package.json:69,dist/act-compat.js:10,12,types/index.d.ts:10}`; `react-dom@19.3.0` `exports` map; `tsconfig.json:7` |
| E12 | **The manual type-review surface is 31 sites, and no codemod covers it.** They use the Radix v1 idiom `React.forwardRef<React.ElementRef<typeof X>, React.ComponentPropsWithoutRef<typeof X>>` across 8 `ui/` files (`alert-dialog`, `dialog`, `dropdown-menu`, `label`, `select`, `separator`, `tabs`, `tooltip`). 14 more use `React.HTMLAttributes<T>` (`card`, `table`), and 2 are bespoke (`button.tsx:38`, `input.tsx:5`). The React 19 `types-react-codemod` transforms do **not** cover `React.ElementRef`. Peer problems surface as **warnings**, not errors: neither `.npmrc` nor `pnpm-workspace.yaml` sets `strict-peer-dependencies`. | A1 audit counts; `tsconfig.json:17` `"jsx": "react"`; `.npmrc`, `pnpm-workspace.yaml` |
| E13 | **The breakage the plan predicted did not happen.** `@types/react@19.3.0` still exports `React.ElementRef` and `React.ComponentPropsWithoutRef`, so all **31 sites were left untouched and `tsc` is clean**. E12 correctly identified the *review surface*, but that surface needed **zero edits** — A2 turned out to be a four-line dependency change. | `npm run type-check` → exit 0 with **0 files changed under `src/**`** (`git status --porcelain` shows only `package.json` + `pnpm-lock.yaml`); `pnpm why react --depth 20` resolves a single `react@19.3.0` for the entire graph |
| E14 | **The A2/A3 split has exactly one visible cost, and it is the warning E12 predicted as harmless.** pnpm reports `react-flatpickr 3.10.13 → ✕ unmet peer react ">=16, <=18": found 19.3.0`. It is a warning, not an error (no `strict-peer-dependencies`), and E5 establishes the runtime is unaffected — but the declaration now contradicts the installed tree until A3 moves it to v4. Separately, the lockfile keeps a second `@types/react@18.3.23` alive **only** because `@types/react-router-dom@5.3.3` (devDep, already flagged stale in E8) declares `@types/react: "*"`, which pnpm resolved to 18 and not 19. `tsc` is unaffected (`types: ["vite/client","node"]` + `skipLibCheck: true`), and the duplicate disappears with that devDep. | pnpm install output; `pnpm-lock.yaml:1449` and `:5631` (`'@types/react-router-dom@5.3.3' → '@types/react': 18.3.23`) |
| E15 | **The local `node_modules` had been installed by a different package manager than the one the repo locks.** `pnpm add` reported **54 packages** "installed by a different package manager", moved them to `node_modules/.ignored`, and rebuilt the tree. CI's documented path is unaffected (`pnpm install --frozen-lockfile` exits 0, "Lockfile is up to date"), but "it worked locally" had until now been measured against a tree the lockfile did not describe. Unpruned and unreachable leftovers of the pre-bump tree (`react@18.3.1`, `@types/react@17.0.83`) still sit in `.pnpm`; nothing resolves to them. | pnpm's own move warnings (54 entries); `pnpm install --frozen-lockfile` → exit 0; `require.resolve('react/package.json')` → `.pnpm/react@19.3.0/node_modules/react/package.json` |
| E16 | **React 19 un-hid the date field's original input, so the form rendered two date rows.** flatpickr's `altInput` mode hides the original input by setting `type="hidden"` imperatively and inserts its own visible alt input; react-flatpickr renders that input with **no `type` prop**, so React 19's rewrite of the `type` attribute on the commit where `value` changes **deletes** the attribute and the original reverts to a visible `text` input (two rows: ISO on top, `altFormat` below). Causality is a controlled A/B — identical source, identical `flatpickr@4.6.13`, identical `react-flatpickr@3.10.13`, identical StrictMode state, React the only variable: installed **React 18.3.1** → `[0] type="hidden"` (one row); installed **React 19.3.0** → `[0] type=null` (two rows). Note the source files are byte-identical across the two runs, because A2 changed only `package.json` + the lockfile. | controlled A/B in a worktree at `892e9d2` (React 18.3.1) vs the working tree (React 19.3.0), same probe file; `flatpickr/dist/esm/index.js:1765-1775` (`setupInputs`: `setAttribute("type", "hidden")`); `node_modules/react-flatpickr/lib/index.js:141-164` (`render` passes props through, so the component never declares `type`) |
| E17 | **A minimal repro isolated the trigger and validated the fix before any app code was touched.** Matrix over raw react-flatpickr: *static value, no `type`* → original hidden; ***value changes*, no `type`* → **original visible** (this is the trigger, and it is exactly what react-hook-form does when it hydrates the draft); *value changes, `type="hidden"`* → original hidden. The fix is that last row: declare `type="hidden"` so React's model agrees with flatpickr's intent. **Every machine gate was green while the bug was live** (183/183, `type-check`, `lint`, `build`), which is why only a human looking at the app could find it. | throwaway jsdom probe, six cases; the committed regression test `src/tests/renderer/inputDate.test.tsx` pins the same contract; suite went 183 → **185** |
| E18 | **What `react-flatpickr@4.0.11` actually does — read from the installed package, not the registry (F1's rule).** v4 is a hooks function component with ESM output plus a CJS fallback; it drops `prop-types`, ships its own declarations through its `exports` map, and its peer range is `react: ">= 16 <= 19"` (which is why the v3 peer warning above disappears). Behaviourally: the input is rendered **controlled** to `value.toString()`; `setDate` runs only when the prop differs from the input's current value; the native change event is wrapped into `[new Date(value)]`; the ref API is a `DateTimePickerHandle`; and — the part that decided this task — **it mutates the options object it is handed** to move top-level hook props inside it, then **destroys and recreates the flatpickr instance whenever the merged options identity changes**. | `node_modules/react-flatpickr/package.json` (`version`, `exports`, `type`, `dependencies`, `peerDependencies`); `node_modules/react-flatpickr/build/react-flatpickr.js` (imports, imperative handle, options merge, create effect, setDate guard, native-event onChange, render spread); `build/react-flatpickr.d.ts` |
| E19 | **That instance-rebuild is why A3 was a rewrite and not a version bump.** The old call-site pattern — handlers as top-level props plus inline or memoized `options` — is broken under v4: **inline options rebuild the instance on every parent render** (an open picker closes), and **memoized options accumulate one extra `onChange` entry per render**. `WorkTimeForm` re-renders every second while the live timer runs, so both were reproduced rather than theorised. All three call sites now build a stable options object, register the change handler inside `options`, read the latest handler through a ref, leave the input uncontrolled and drive flatpickr with `setDate`. `time-picker.tsx` additionally stopped emitting `NaN:NaN`, which was v4's native-event path feeding `"HH:mm"` to `new Date`. | `git diff --numstat`: `input-date.tsx` +68/−25, `input-time.tsx` +77/−15, `time-picker.tsx` +63/−27; pinned by `src/tests/renderer/timePickers.test.tsx` (new, 136 lines) |
| E20 | **`type="hidden"` had to stay, and `@types/react-flatpickr` had to go.** v4 still renders its input from a spread without declaring `type`, so React 19 still deletes flatpickr's imperative `hidden` — a controlled A/B against the installed v4 gave two visible inputs without the declaration and one with it. Separately, `@types/react-flatpickr` is now redundant: v4's `exports.types` resolves under `strict`, and removing it leaves `tsc` at exit 0. | `git diff package.json` (exactly two lines: `react-flatpickr` → `^4.0.11`, `@types/react-flatpickr` removed); `node_modules/react-flatpickr/package.json` `exports` |

## Track order, and why this order

| # | Track | Rationale |
|---|---|---|
| **A** | **React 19 + the renderer versions coupled to it** — this document | The user's priority; and it is the *input* to the Fase 2 / Compiler decision. Lowest uncertainty of the majors (E1, E3) |
| B | Tailwind 4 (+ drop `autoprefixer` and `tailwindcss-animate`, add `tw-animate-css`) | Independent of app logic; failure mode is visual |
| C | Vite 8 / Rolldown + `@vitejs/plugin-react` 6 | Build tooling; can be swapped independently of app behaviour |
| D | TypeScript 7 (native port) | Highest uncertainty |
| E | ESLint 10 + `typescript-eslint` | Must move with TS, and it is part of the **gate** used to verify everything else |
| F | Vitest 5 | Part of the gate; move last so the gate is stable while the app changes |
| G | React Compiler | Its own doc, with a **measured spike on `WorkTimeForm`**. The compiler bails out on code it cannot analyze, and that can only be established by running it on this codebase, not by reading docs |

**Why React first and the tools later:** the toolchain tracks (D, E, F) *are* the verification gate. Upgrading
the gate in the middle of app changes makes every later failure ambiguous about which change caused it.
So the gate stays stable while the application moves.

## Constraints

- **Node stays on 22.** E2 shows it satisfies every target. Do not bump `.node-version` or the CI
  `node-version` without new evidence.
- **No version bump, tag, release or publish in any track.** Those stay separate human decisions, exactly
  as the `v1.10.0` and `v1.11.0` work did.
- **183 tests are the regression floor** for every track.
- **One track per commit series.** A track that leaves the suite red is not a track; it is a revert.
- Conventional commits, English artifacts, no AI attribution.

## Verification mode

- **TDD: not enabled** — unchanged from the earlier finding (nothing in the repo enables it, and the
  testing-capabilities cache has never been written). Ordinary functional verification: the suite is the
  floor and behavioural changes get tests.
- **Runner:** `npm test` → `vitest run`. **Gates:** `npm run type-check`, `npm run lint`, `npm run build`.
- **Extra gate for this track:** a **human smoke test of the packaged app**, because the renderer is the
  product. Machine gates prove the code compiles and the units behave; they do not prove the UI renders.
  This is the same standard the Electron migration was held to, and it is the reason its last item stayed
  open until a human confirmed it.

## Authorized scope

`package.json`, `pnpm-lock.yaml`, `src/**`, and any configuration file the React track forces. Plus this
document.

**Not authorized by this track:** Tailwind, Vite, TypeScript, ESLint and Vitest config or version
changes (tracks B–F, each with its own document), the React Compiler (track G), and any version bump,
tag or publish.

## Tasks — Track A

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| A1 | **Readiness audit before any bump:** whether `react-flatpickr` (v3 installed, v4 latest) is React-19-safe and what v4 changed; and which React 19 changes actually touch this app's code paths | read-only | delegated (explore) | [x] — findings E5, E10, E11, E12 |
| A2 | Bump `react`, `react-dom`, `@types/react`, `@types/react-dom` to 19, **leaving `react-flatpickr` at 3.10.13**. It runs correctly on 19 (E5); the only problem is the peer *declaration*, so the bump must not be entangled with a wrapper rewrite | `package.json`, `pnpm-lock.yaml` | direct inline (a dependency edit; the audit removed the unknowns) | [x] — `^19.3.0` on all four; the only install warning is the predicted flatpickr peer one (F6) |
| A3 | Move `react-flatpickr` to **4.0.11** as its **own isolated step**, after A2 is green. v4 is a hooks rewrite that always coerces `value` and wraps `onChange`, so the three call sites' contract must be re-verified, not assumed | `package.json`, `ui/input-date.tsx`, `ui/input-time.tsx`, `ui/time-picker.tsx` | delegated (one writer) — three call sites plus a behavioural contract | [x] — v4 installed; **all three call sites had to be rewritten**, not merely re-verified (E19). Committed `34577dc`; suite 189/189. **The review is blocked, not declined** — see F11 |
| A4 | Move the renderer versions coupled to React 19: `i18next` 26 + `react-i18next` 17 (E7), `react-router-dom` 7, and the safe minor bumps | `package.json`, `pnpm-lock.yaml` | direct inline | [ ] |
| A5 | Fix what the bump breaks — the 31 `React.ElementRef` sites are the expected surface (E12) | `src/**` | direct inline (one component + one regression test) | [x] — the *expected* surface did **not** break (E13); the bump broke something else instead. Real fix: `input-date.tsx` + `src/tests/renderer/inputDate.test.tsx` (E16, E17, F8) |
| A6 | Verify: suite, `type-check`, `lint`, `build`, and a **human smoke test of the packaged app**. The date/time pickers are the highest-risk surface (A3) | — | per-action workers | [x] — machine gates green (**191/191**), and the human smoke test passed **twice**: once on the A2 fix (date field back to one row) and again after A3 + the StrictMode fix (date and duration both show their value when the view opens and after returning to it) |
| A7 | Record results, evidence and residue here | this document | direct inline | [x] — recorded incrementally through E1–E20, F1–F12, the Route log, the Delivery plan and both Review records. **What is not recorded as done is not done:** A3 and its remedy are un-reviewed (F11, F12), and A4 is untouched. |

Task detail is deliberately deferred to A1's result: writing a fix-list before knowing what actually
breaks would be inventing work.

## Acceptance criteria

- `react` and `react-dom` are on 19.x; `@types/react`/`@types/react-dom` on 19.x.
- **All 183 tests pass**, `type-check`, `lint` and `build` are clean.
- No React 19 deprecation warning is introduced in the app's own code.
- The app launches, the frameless window renders, `WorkTimeForm` (including the live timer and the
  flatpickr date pickers), the tables, the reports and the update badge all behave — confirmed by a
  human, not by a machine.
- `pnpm install --frozen-lockfile` succeeds, so CI's install path is not broken.
- Anything the upgrade cannot fix within this track is recorded as a finding, not quietly left.

## Findings during implementation (not in the plan)

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | **This document's own first draft contained a factual error about the very risk it was assessing.** It claimed `react-flatpickr` declares React 19 support. It does not: the *installed* `3.10.13` declares `react: ">=16, <=18"`. The draft had run `pnpm view react-flatpickr peerDependencies`, which answers for the **latest** version (4.0.11), and written the answer down as if it described the installed one. The A1 audit caught it. This is the same class of mistake the performance doc already recorded as F8/F9 (reasoning from the wrong source instead of measuring the artefact in place). | Draft E1 vs. `node_modules/react-flatpickr/package.json:68-70`; corrected in E1 | Corrected in E1/E5 before any code was touched. **Lesson recorded: for a version question, read `node_modules/<pkg>/package.json`, not the registry.** |
| F2 | **`react-dom/test-utils` was NOT removed in React 19.3.0** — it survives as a deprecated shim, and `@testing-library/react`'s `act-compat` prefers `React.act` and only falls back to the shim. So the testing path is safe; the widely-repeated "it was removed" framing is wrong for this version. The real residue is **type-level**: RTL's own `.d.ts` still imports the subpath that `@types/react-dom@19` drops, hidden here only by `skipLibCheck: true`. | E11 | Recorded. If `skipLibCheck` is ever turned off, this is the first thing that will break. |
| F3 | **`react-flatpickr@4` is not a drop-in even though the ref change does not apply here**: the rewrite always renders a coerced `value` and wraps native `onChange` into `[Date]`, while `input-time.tsx:26-32` passes `value={field.value || []}` (an array). Whether v4 changes observable picker behaviour is **not established** — the audit did not install or run v4. | A1 audit, v4 built source | A3 is deliberately isolated so this risk cannot be confused with the React bump. A6's human smoke test is the check that actually settles it. |
| F4 | **A1's own findings are as valuable as the bump**: the peer ranges of the *installed* tree were never checked before, and one of them was wrong in the direction that matters (a dependency that does not declare support for the new major). | E1, E5 | This is why the audit was a task and not a formality. |
| F5 | **The plan's own "expected surface" was a hypothesis, and it was wrong in the safe direction.** E12 predicted the 31 `React.ElementRef` sites as the fix surface; nothing broke (E13). Recorded rather than quietly dropped, because a prediction that never materialises is still a prediction, and the next reader needs to know the difference between "we planned this" and "we measured this". | E13 | A5 closed as a **no-op**. The 31 sites remain a genuine *review* surface if `@types/react` ever drops `ElementRef` — but that is a future, not this upgrade. |
| F6 | **A2 and A5 turned out to be one four-line change, so the A2/A3 split is doing all the risk-isolation work by itself.** The only thing the split costs is the visible peer warning (E14), and the only thing it buys is that the flatpickr rewrite cannot be confused with the React bump. | `git diff package.json` = 4 changed lines (`react`, `react-dom`, `@types/react`, `@types/react-dom`) | Kept. A3 is still isolated: F3's behavioural question (v4 coerces `value`, wraps `onChange` into `[Date]`, while `input-time.tsx:26-32` passes an array) is unsettled and must not share a commit with the bump. |
| F7 | **Local install drift, found by accident.** The repo locks with pnpm and CI installs with pnpm, but the working `node_modules` had been produced by a different package manager; pnpm moved 54 packages aside and rebuilt (E15). Nothing in this upgrade required it, and it invalidates nothing — but it is the same class of error as F1: trusting a local artefact instead of the one the record describes. | E15 | Recorded as environment hygiene. `package.json` and `pnpm-lock.yaml` are the artefacts that matter; `node_modules` is gitignored and now matches them. |
| F8 | **Every machine gate was green on a build with a visible defect, and the human smoke test was the only thing that caught it.** 183/183 tests, `type-check`, `lint` and `build` all passed on React 19 while the date field rendered two rows (E16). This is not a failure of the gates' execution but the ceiling of what they could see: nothing in the suite rendered a flatpickr-backed input, so no test described the contract that broke. The lesson is not "add more tests" in the abstract — it is that **a renderer major moves runtime behaviour, and unit tests only cover it where someone already chose to look.** The plan's extra human step was not ceremony; it was the only instrument that could have found this. | E16, E17; the user's smoke test of the running app | Fixed in `input-date.tsx` with a regression test. **The smoke test must be re-run after the fix** — that is the remainder of A6. |
| F9 | **The A2 review's R3 warning was a correct prediction, not boilerplate.** It stated, for that exact candidate, that a dependency-only diff carries no assertion that observable behaviour survives the major. It then tested true: the defect lived precisely in the gap between the changed bytes (`package.json` + the lockfile) and the unchanged component runtime. The response was already the right one — route it to A6 — and A6 is where it surfaced. Worth recording that the warning earned its place. | E16, E17; the A2 Review record | No change to process. It is evidence *for* the existing rule that verification of behaviour belongs to a step that can observe behaviour. |
| F10 | **A3's scope line said "re-verified, not assumed" — the honest outcome is that the call sites had to be *rewritten*.** The plan framed A3 as a version move with a contract check (F3). That check is what produced the rewrite: v4's instance rebuild is invisible in a diff and only shows itself when a parent re-renders — and this parent re-renders every second. Recorded so the 421-line slice is read as "the migration the library required", not as scope creep. | E18, E19 | Kept as the A3 work unit. Deliberately **not** split: splitting the rewrite across two PRs would land v4 with two of three call sites still on the pattern it breaks. |
| F11 | **The A3 slice has no review, and that is not because the review declined it.** The gate opened lineage `review-16182467d565e446`, selected one lens (`review-reliability`) and offered the slot. The reviewer actor returned an empty result **twice** (`opencode_task_output_empty`), and after each attempt a fresh target-bound STATUS still reported `collect` / `reviewer_results_required` with the authority untouched. Two attempts is the bounded retry, so it stopped there. **State: un-reviewed with an open lineage** — no capture, no receipt, no acknowledgement, nothing burned. Not a Gentle AI engine failure and not reported as one: the reviewer is a client-runtime actor, and an empty sub-agent result is the runtime's. The honest record is that a dependency-plus-rewrite slice of this kind would ship **without independent review**, which is a residual risk the next session must close or consciously accept. | lineage `review-16182467d565e446`; `gentle-ai review status` after each attempt | Retry in a fresh session while the slot is still offered, or accept the risk explicitly. **Never claim this candidate was reviewed.** |
| F12 | **The reviewer actor is unavailable in this session, and the bounded retry is now spent on both lineages.** The StrictMode fix (`c3f800f`) changed the candidate, so the gate opened a **fresh** lineage `review-adc411d312248c2a` and offered one `review-reliability` slot; the reviewer actor returned `opencode_task_output_empty` on the first attempt. State after: `state: reviewing`, `generation: 1`, `action: collect`, `reason_code: reviewer_results_required`, authority untouched — **no capture, no receipt, no acknowledgement, nothing burned, no result invented.** Three empty reviewer results across two lineages is an actor/session problem, not a candidate one: the *same* actor completed the A2 review earlier in this session, and the failure reproduced both with a hand-authored materialisation and with the bare provider binding alone (which rules out the prompt size I suspected). No further attempts were made. | lineages `review-16182467d565e446` (2 attempts) and `review-adc411d312248c2a` (1 attempt); `gentle-ai review status` after each | Neither the A3 migration nor its remedy carries an independent review. Close it in a fresh session, or accept the residual risk in writing. **Not a Gentle AI engine defect and not reported as one** — an empty sub-agent result belongs to the client runtime. |

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| Inventory and gap measurement | direct inline | ≤3 files plus registry queries; state gathering, not exploration |
| A1 | delegated (one narrow read-only audit) | crosses several files and one external package's internals |
| A2 | direct inline | as planned: one hand-authored file (`package.json`); the audit had already removed the unknowns and A1 had done the cross-file reading |
| A5 | **no work — the delegation trigger never fired** | the writer rule (2+ non-trivial files) never activated because **zero files needed editing** (E13) |
| A3 | delegated (one writer) | the writer rule fired as planned: three non-trivial call sites plus a behavioural contract. The extra finding is that the contract check *produced* a rewrite rather than confirming one (F10) |

## Delivery plan (decided 2026-09-27)

`delivery_strategy: ask-on-risk` → **`chain_strategy: stacked-to-main`** (each PR merges to main in order).
Trigger: the running authored count crossed the ~400 budget at A3, so the `chained-pr` and
`work-unit-commits` skills were loaded before slicing. Authored counts exclude the generated lockfile and
this document.

| PR | Commits | Authored lines | State |
|---|---|---|---|
| **1 — React 19** | `23b361f` + `c0ececd` | 88 | The bump **plus the date-field regression it caused**, with its test. They ship together because a PR must not merge a known user-visible regression. Bump reviewed and approved; the fix was assessed `under_budget` and never separately reviewed. |
| **2 — react-flatpickr 4** | `34577dc` | 421 | The migration and the three call-site rewrites. **Over budget by 21** — see below. |
| **3 — the coupled renderer versions** | — (A4, not started) | unknown | `i18next` 26 + `react-i18next` 17 + `react-router-dom` 7 + the safe minor bumps. |

**`size:exception` recommended for PR 2.** One honest slicing pass was made, and no cohesive split exists:
splitting the wrapper rewrite would land v4 with two of the three call sites still on the pattern v4
breaks, which is a regression, not a slice — so the `chained-pr` gate "each slice can land independently"
does not hold. Per the skill, the overage is reported rather than shrunk by deleting comments or tests.

## Review record — A2 candidate

Whole-candidate native review: **one lens** (`review-reliability`, medium risk, tier `medium`), lineage
`review-6f157c82099b9c26`. The candidate was the frozen pair `package.json` + the generated
`pnpm-lock.yaml` (767 changed lines; the lockfile is what crossed the slice budget).

**Verdict: approved.** The last admitted capture committed the acknowledgement token; the exact
acknowledgement burned the authority (`gentle-ai.review-acknowledged/v1`, `authority: burned`,
`consumed_revision` `sha256:832c159b…`). **No correction was opened**, so the frozen correction budget was
never used. Three non-blocking findings:

| ID | Severity | Claim | Disposition |
|---|---|---|---|
| R3-REACT19-NO-BEHAVIOR-PROOF | WARNING | The candidate moves a runtime major but contains no assertion that observable behaviour survives it — no re-run or extension of the suite, no smoke render. | **Valid, and structural to the candidate — carried to A6.** The reviewer can only see the diff; the proof (183/183, type-check, lint, build) was executed by the orchestrator and lives outside the frozen trees. That is exactly the gap A6's human smoke test exists to close. Not "fixed" here, and not a reason to re-review this candidate. |
| R3-TYPES19-UNADAPTED-SOURCES | WARNING | The type packages move in lockstep while no source path is in the candidate, so nothing inside the candidate shows the gate still passes. | **Same disposition.** Measured clean (E13). The reviewer's specific predictions (`React.FC` implicit `children`, bare `useRef()`, the `JSX` namespace) are exactly the surfaces E3/E10 already recorded as **absent** from this codebase. |
| R3-LOCKFILE-GRAPH-UNVERIFIABLE | SUGGESTION | Lockfile hunks were withheld as generated content, so the resolution of the `^19.3.0` ranges and any unmet-peer warnings cannot be confirmed from the reviewer's view. | **Valid limitation, separately verified.** `pnpm install --frozen-lockfile` exits 0 and `pnpm why react` resolves exactly one `react@19.3.0` (E14, E15). The withheld-content design is deliberate: the check for a lockfile is a frozen install, not a reviewer reading hunks. |

The lesson worth keeping: **a dependency-only candidate cannot carry its own behavioural proof.** Both
warnings say the same true thing from different angles, and the answer is not a better diff — it is A6.

**Postscript (same day): the prediction tested true.** The A2 candidate was approved, and the human smoke
test that followed found a real, user-visible regression that this review structurally could not see
(E16, F8). This is not a defective review. The reviewer inspected the frozen trees it was handed, the
defect is not in those bytes, and R3 named the gap in advance. It is the boundary of the instrument —
recorded so the next dependency-only candidate is read with the right expectations instead of being
trusted as behaviourally complete.

## Progress

- 2026-09-27 — Track A opened. Inventory and gap measured against the npm registry. The codebase was
  confirmed clean of legacy React APIs (E3). React 19 was **first claimed** here to be unblocked at the
  peer-dependency level — that claim was wrong for one package and is corrected in E1.
  **No source file has been touched.**
- 2026-09-27 — **A1 complete** (read-only audit, delegated). Result: the installed `react-flatpickr@3.10.13`
  runs correctly on React 19 despite declaring `<=18`, so the hazard is the peer *declaration*, not the
  code (E5); testing is safe and the "removed `react-dom/test-utils`" belief is wrong for 19.3.0 (E11);
  the expected type surface is the 31 `React.ElementRef` sites (E12); every other React 19 removal is
  absent from this codebase (E10). The audit also caught this document's own error (F1). A2–A7 are now
  defined, and A3 was deliberately isolated so the wrapper rewrite cannot be confused with the bump.
- 2026-09-27 — **A2 complete, A5 closed as a no-op** (direct inline as planned). `react`, `react-dom`,
  `@types/react`, `@types/react-dom` → `^19.3.0`; `react-flatpickr` deliberately left at `3.10.13`.
  **Four lines** in `package.json`; lockfile regenerated; **zero source files edited** (E13). Gates on
  React 19: `npm test` **183/183** (18 files), `npm run type-check` clean, `npm run lint` clean,
  `npm run build` exit 0, `pnpm install --frozen-lockfile` exit 0. The single warning is the predicted
  flatpickr peer one (E14/F6). **Not yet verified: the human smoke test (A6)** — machine gates prove
  compilation and unit behaviour, not that the UI renders.
- Delivery strategy: `ask-on-risk`. Measured so far: **88 authored lines** of product change — 8 in
  `package.json` (4 additions + 4 deletions), 7 in `input-date.tsx` and 73 in the new regression test —
  with the generated lockfile and this document's own edits excluded. Far under the ~400 budget, so no
  slicing decision is due. Re-evaluate at A3 and A4. — ***Superseded:** A3 crossed the budget; see the
  Delivery plan.*
- 2026-09-27 — **A2's work unit reviewed and approved** (native RDD, one lens `review-reliability`,
  lineage `review-6f157c82099b9c26`). Authority burned by the exact acknowledgement; no correction opened.
  Three non-blocking findings, all three carried to **A6** rather than patched here — see the Review
  record. Work-unit commit `23b361f` is the reviewed boundary for the next assessment.
- 2026-09-27 — **The human smoke test found a real A2 regression, and it is fixed.** In `WorkTimeForm` the
  date field rendered **two rows** on React 19: React deletes the `type` attribute flatpickr had set
  imperatively on the wrapper's original input, so the input that flatpickr intends to hide becomes a
  visible second date field (E16). Causality was established by a controlled A/B against React 18.3.1 —
  identical source, identical library versions, React the only variable — and the fix was validated on a
  minimal repro **before any app code changed** (E17). Fix: declare `type="hidden"` in `input-date.tsx`
  so React's model agrees with flatpickr's; regression cover in
  `src/tests/renderer/inputDate.test.tsx`. Gates: **185/185** (183 floor + 2 new), `type-check`, `lint`
  and `build` clean. **A5 stopped being a no-op** — the bump did break something, just not the surface
  the plan predicted. **The smoke test must be re-run on this fixed build**, which is the remainder of A6.
- 2026-09-27 — **A5's fix is committed as `c0ececd`; the review gate reports `medium` / `under_budget`.**
  Post-fix assessment over `23b361f..HEAD`: 3 paths, 153 changed lines, `review_due: false`, reason
  `under_budget`. By the gate's own batching rule this change **stays pending in the slice** until a later
  commit reaches the ~400-line budget, so it has no separate review yet. The reviewed boundary remains
  `23b361f`, and the next assessment is measured from there.
- 2026-09-27 — **The Engram mirror for this session is PENDING, not written.** `mem_save` failed three
  times with `gentle-engram could not confirm Engram session registration for engram_mem_save`, while
  `mem_doctor` reported the store healthy (9/9 checks `ok`, project `tw-time-register`). The write path
  refused; the store did not. Nothing is lost — **this document is the authoritative record** and it is
  committed — but the mirror must be re-synchronised in the next session.
- 2026-09-27 — **The smoke test on the fixed build passed.** The date field renders one row again, and
  nothing else in the app changed. A6's remaining item is now only the **post-A3** pass over the
  date/time pickers.
- 2026-09-27 — **Stale worktree registrations from an earlier session removed** (`s123-review/s1|s2|s3`,
  under the temp dir). Inspected before removal: all three were detached HEADs on commits already
  reachable from `main`, `staging`, `origin/*` and tag `v1.10.0`, with **no uncommitted changes, no
  stashes and no unique commits**. Nothing was lost; only the registrations went.
- 2026-09-27 — **A3 complete, committed `34577dc`.** `react-flatpickr` `3.10.13` → `^4.0.11`, and the
  three call sites were **rewritten**, not re-verified: v4 mutates the options object and rebuilds the
  instance whenever its identity changes (E18), so the old top-level-hook-props pattern closes an open
  picker on every parent render and accumulates a duplicate `onChange` per render (E19). Gates:
  `npm test` **189/189** (185 floor + 4 new), `type-check`, `lint`, `build` and
  `pnpm install --frozen-lockfile` all clean — the parent independently re-ran `npm test` as a spot check.
  `type="hidden"` retained after a controlled A/B against v4; `@types/react-flatpickr` removed (E20).
- 2026-09-27 — **Delivery plan agreed: `stacked-to-main`**, three PRs (see the Delivery plan). A3 is the
  authored-line trigger: **421 lines for A3 and ~509 for the slice**, against a ~400 budget. PR 2 carries a
  reported overage of 21 lines and a **`size:exception` recommendation**, because no cohesive split exists.
- 2026-09-27 — **A3's review is blocked, not declined (F11).** The gate opened lineage
  `review-16182467d565e446` and offered one `review-reliability` slot; the reviewer actor returned an empty
  result twice and the target-bound STATUS still reports the slot offered with the authority untouched.
  **No capture, no receipt, no acknowledgement, nothing burned, and no result has been invented.** The
  candidate is **un-reviewed with an open lineage**, and that is the state the next session inherits.
- 2026-09-27 — **The Engram mirror is still PENDING.** Two more `mem_save` attempts failed the same way
  (`gentle-engram could not confirm Engram session registration`), including one from the delegated writer.
  This document remains the authoritative record.
- 2026-09-27 — **The smoke test found a second, deeper A3 regression, and it is fixed (`c3f800f`).** After
  A3 the date and duration fields showed **empty** whenever `WorkTimeForm` mounted, while the value stayed
  intact in the form the whole time — a display bug, not data loss, confirmed by watching the form value
  rather than the DOM. Cause: under `React.StrictMode` (which the app uses, `main.tsx:10`) v4 renders
  twice with the *same* props object, so its props-copy memo returns the copy it already mutated by
  deleting `onCreate` (`build/react-flatpickr.js:22-23`); `onCreate` becomes `undefined`, which is also in
  the create effect's dependency list (`:34-46`), so the instance is destroyed and rebuilt and the
  replacement is never published — the live instance sat at `selected=0`. **Fix:** all three pickers
  publish the instance *and* apply the current value from flatpickr's own `onReady`, which lives inside
  `options` (untouched by v4) and fires at the end of every init
  (`flatpickr/dist/esm/index.js:88`); the instance is held in state so a replacement re-runs the sync
  effect. **Coverage gap closed:** both picker test files now render under `React.StrictMode` — they did
  not, and that is why 189 tests were green on a visibly broken app. Gates: **191/191**, `type-check`,
  `lint`, `build` clean.
- 2026-09-27 — **This candidate's review is blocked too (F12).** Fresh lineage
  `review-adc411d312248c2a`, reviewer actor returned empty on the first attempt, authority untouched. The
  bounded retry is spent; no further attempts. **The A3 slice and its remedy are un-reviewed.**

## Resume — the next session starts here

State at hand-off: Track A is functionally complete **except A4**. Branch `staging`, 17 commits ahead of
`origin/staging`, nothing pushed, working tree clean, all four gates green at **191/191**.

1. **Close the A3 review first (F11, F12).** The reviewer actor returned an empty result three times in the
   previous session across two lineages, so nothing is captured and nothing is burned — the slot is still
   offered. From a fresh session, the entry point is:
   `gentle-ai review assess --cwd . --agent opencode --base-ref 23b361f --committed-only --json`
   then execute the returned `next_transition` verbatim and follow its transitions. **Do not claim the A3
   slice or its remedy were reviewed unless an acknowledgement actually burned authority.**
2. **Then A4** — `i18next` 26 + `react-i18next` 17 + `react-router-dom` 7 + the safe minor bumps. It is the
   last task in Track A. It will push the delivery slice further past the budget, so re-read the Delivery
   plan before the first commit and keep `stacked-to-main`.
3. **The Engram mirror is still pending.** Every `mem_save` in the previous session failed with
   `gentle-engram could not confirm Engram session registration for engram_mem_save` while `mem_doctor`
   reported the store healthy (9/9). Re-synchronise it on arrival, and until then treat this file as the
   only record.
4. **Constraints unchanged:** no Node bump (22.17.0 satisfies every target), no version bump, tag or
   publish; English artifacts; the reviewed boundary is still `23b361f`.
