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
| A2 | Bump `react`, `react-dom`, `@types/react`, `@types/react-dom` to 19, **leaving `react-flatpickr` at 3.10.13**. It runs correctly on 19 (E5); the only problem is the peer *declaration*, so the bump must not be entangled with a wrapper rewrite | `package.json`, `pnpm-lock.yaml` | direct inline (a dependency edit; the audit removed the unknowns) | [ ] |
| A3 | Move `react-flatpickr` to **4.0.11** as its **own isolated step**, after A2 is green. v4 is a hooks rewrite that always coerces `value` and wraps `onChange`, so the three call sites' contract must be re-verified, not assumed | `package.json`, `ui/input-date.tsx`, `ui/input-time.tsx`, `ui/time-picker.tsx` | delegated (one writer) — three call sites plus a behavioural contract | [ ] |
| A4 | Move the renderer versions coupled to React 19: `i18next` 26 + `react-i18next` 17 (E7), `react-router-dom` 7, and the safe minor bumps | `package.json`, `pnpm-lock.yaml` | direct inline | [ ] |
| A5 | Fix what the bump breaks — the 31 `React.ElementRef` sites are the expected surface (E12) | `src/**` | delegated if it exceeds a few files | [ ] |
| A6 | Verify: suite, `type-check`, `lint`, `build`, and a **human smoke test of the packaged app**. The date/time pickers are the highest-risk surface (A3) | — | per-action workers | [ ] |
| A7 | Record results, evidence and residue here | this document | direct inline | [ ] |

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

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| Inventory and gap measurement | direct inline | ≤3 files plus registry queries; state gathering, not exploration |
| A1 | delegated (one narrow read-only audit) | crosses several files and one external package's internals |
| A2–A6 | pending A1 | — |

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
- Delivery strategy: `ask-on-risk`. Forecast: unknown until A1 lands; if the React track exceeds the
  ~400 authored-line budget it gets sliced then, not pre-emptively.
