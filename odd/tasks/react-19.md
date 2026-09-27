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
| E1 | **React 19 has zero peer-dependency blockers in this app.** Every renderer dependency already declares React 19 support — including `react-flatpickr`, the one I expected to block (`react: ">= 16 <= 19"`). | `pnpm view <pkg> peerDependencies` for all 12 renderer deps: `react-flatpickr >= 16 <= 19`; `sonner` `^18 \|\| ^19`; `lucide-react` `^16.5.1 \|\| ^17 \|\| ^18 \|\| ^19`; `react-router-dom >=18`; `@testing-library/react ^18 \|\| ^19`; `react-hook-form ^16.8 \|\| ^17 \|\| ^18 \|\| ^19`; Radix `^16.8 \|\| ... \|\| ^19`; `@tanstack/react-table >=18` |
| E2 | **Node does not need to be bumped.** Every tool target is satisfied by the installed **22.17.0**. | `vite@8` → `^20.19.0 \|\| >=22.12.0`; `vitest@5` → `^22.12.0 \|\| ^24 \|\| >=26`; `eslint@10` → `^20.19.0 \|\| ^22.13.0 \|\| >=24`; `@vitejs/plugin-react@6` → `^20.19.0 \|\| >=22.12.0`; `typescript@7` → `>=16.20.0`. Installed `node -v` = `v22.17.0`, `.node-version` = `22` |
| E3 | **The codebase is already clean of every legacy React API that makes 19 painful.** | `rg` over `src/**`: `createRoot` at `src/renderer/main.tsx:7`; **0** hits for `findDOMNode`, `unmountComponentAtNode`, `hydrateRoot`, `.defaultProps`, `propTypes`, `childContextTypes`, `React.FC`, bare `useRef()`, `JSX.Element` |
| E4 | **47 `forwardRef` occurrences exist, and they are a cleanup opportunity — not a blocker.** `forwardRef` still works in React 19; passing `ref` as a prop is the new preference and the deprecation is not a removal. | `rg -o forwardRef src` = 47 |
| E5 | **`react-flatpickr` is the one genuine unknown.** Installed `^3.10.13`; latest is `4.0.11` (published 2025-07-08) whose peer is `{ react: ">= 16 <= 19" }`. Whether the wrapper's internals are React-19-safe, and what v4 changed, is **not** established. | `pnpm view react-flatpickr version time.modified peerDependencies` |
| E6 | **`tailwindcss-animate` cannot survive Tailwind 4.** Its peer is `tailwindcss: ">=3.0.0 \|\| insiders"` — a v3 plugin; Tailwind 4 needs `tw-animate-css`. | `pnpm view tailwindcss-animate peerDependencies` |
| E7 | **`react-i18next` 17 is coupled to i18next.** Its peer requires `i18next >= 26.2.0` while this repo has `^23.11.5`, so the two must move together. | `pnpm view react-i18next@17 peerDependencies` |
| E8 | **Two stale dependency-hygiene items** found while inventorying: `@types/react-router-dom@^5.3.3` (react-router-dom 6+ ships its own types, so this is a v5-era leftover) and `@types/babel__core@^7.20.5` sitting in `dependencies` rather than `devDependencies`. | `package.json` dependency blocks |
| E9 | **Late corrections to this document's own first draft**, made by re-querying instead of trusting recall: `typescript-eslint` latest is **8.70.1**, i.e. a *minor* bump inside 8 — **not** the "9.x major" the first draft of the gap table claimed. The React Compiler is at **1.0.0**, a real release rather than a release candidate. `react-router-dom` latest is **7.18.4**. The Tailwind 4 replacements exist: `tw-animate-css@1.4.0` and `@tailwindcss/vite@4.3.3`. | `pnpm view <pkg> version`, 2026-09-27 |

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
| A1 | **Readiness audit before any bump:** whether `react-flatpickr` (v3 installed, v4 latest) is React-19-safe and what v4 changed; and which React 19 behavioural changes actually touch this app's code paths | read-only | delegated (explore) | [ ] |
| A2 | Bump `react`, `react-dom`, `@types/react`, `@types/react-dom` to 19 | `package.json`, `pnpm-lock.yaml` | pending audit | [ ] |
| A3 | Move the renderer versions coupled to React 19: `react-flatpickr`, `i18next` + `react-i18next`, `react-router-dom`, and the safe minor bumps | `package.json`, `pnpm-lock.yaml` | pending audit | [ ] |
| A4 | Fix whatever the bump breaks — types and runtime — keeping the 183 green | `src/**` | pending audit | [ ] |
| A5 | Verify: suite, type-check, lint, build, and a human smoke test of the packaged app | — | per-action workers | [ ] |
| A6 | Record results, evidence and residue here | this document | direct inline | [ ] |

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
| — | none yet | — | — |

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| Inventory and gap measurement | direct inline | ≤3 files plus registry queries; state gathering, not exploration |
| A1 | delegated (one narrow read-only audit) | crosses several files and one external package's internals |
| A2–A6 | pending A1 | — |

## Progress

- 2026-09-27 — Track A opened. Inventory and gap measured against the npm registry, not assumed. React 19
  confirmed **unblocked at the peer-dependency level** (E1) and the codebase confirmed **clean of legacy
  React APIs** (E3). The one genuine unknown is `react-flatpickr` (E5); A1 resolves it before any bump.
  **No source file has been touched.**
- Delivery strategy: `ask-on-risk`. Forecast: unknown until A1 lands; if the React track exceeds the
  ~400 authored-line budget it gets sliced then, not pre-emptively.
