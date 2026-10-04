# Friendly update experience + reliable relaunch (v1.13.0)

## Objective
Turn the app update flow from a blind "app closes and nothing happens" into a
predictable, observable experience: show real download progress, show a clear
"installing / restarting" state before quitting, confirm the new version on the
next start, and make the silent auto-update reliably relaunch the app.

## Problem
Two problems, one flow:

1. **No feedback.** `src/main/updater.ts` never subscribes to
   `download-progress`, so the NavBar indicator is indeterminate. When the user
   clicks "Install", `quitAndInstall(true, true)` kills the process immediately;
   the renderer shows nothing, and there is no post-restart confirmation. The
   user cannot tell whether the update succeeded.
2. **No relaunch.** Observed on a real client: `1.11.0 -> 1.12.0` installed
   silently but the app did **not** reopen. This matches a known electron-builder
   limitation with the exact `nsis` config in use (`oneClick: false` +
   `allowToChangeInstallationDirectory: true`), tracked in electron-builder
   issues #2179 and #5792. Verified in `node_modules` (`app-builder-lib@26.15.3`,
   `electron-updater@6.8.9`): `force-run` is a registered flag and
   `installSection.nsh` only relaunches when `isForceRun AND Silent` for assisted
   installers — so the config is structurally correct and the gap is in the
   assisted-installer finish flow.

## Why
README already frames `v1.13.0` as the continuation of the update work. The
transport is proven end to end (a real client auto-updated). The remaining gaps
are presentation (progress + confirmation) and the assisted-installer relaunch.

## Scope
**In scope**:
- Main: wire `download-progress` -> renderer; persist a "pending update" marker
  on explicit install and consume it on the next start; expose
  `get-update-result`.
- Renderer: determinate download progress; an "installing / will restart"
  overlay with a short deliberate delay before quitting; a post-restart
  "Updated to vX" toast.
- NSIS: a custom include that force-runs the app when `${isUpdated}`, keeping the
  assisted installer and its install-directory picker.
- Tests for the main and renderer paths, docs.

**Out of scope (deliberate)**:
- Switching to `oneClick: true` (would drop the install-directory picker).
- A real install-time progress bar: the app process is already gone during
  installation, so it is not representable in-app (recorded, not an omission).
- macOS/Linux.
- Changing the background 30 s / 4 h check timers.

## Constraints
- Windows-only target (`win.target: nsis`, x64). NSIS behavior is Windows-specific.
- Never block or crash the app if the marker file cannot be written; the update
  must still proceed.
- The pre-quit delay is a UX affordance, not a guarantee; it must be bounded
  (~1.2 s) and must not delay indefinitely.
- The NSIS relaunch fix can only be verified on a packaged build updating a real
  installed version; unit tests cannot cover it.

## Verification mode
- **TDD: off by absence** (no `strict_tdd`, no testing-capabilities cache, and the
  silent-updates feature recorded the same). Tests are written alongside behavior,
  matching repo convention.
- **Runner**: `npm test` -> `vitest run`. Also `npm run type-check` (`tsc`),
  `npm run lint` (`eslint .`), `npm run build` (`vite build`).

## Authorized scope
Source: `src/main/updater.ts`, `src/main/updateMarker.ts` (new),
`src/main/preload.ts`, `src/renderer/hooks/useAutoUpdater.ts`,
`src/renderer/components/NavBar.tsx`, `src/renderer/locales/en.ts`,
`src/renderer/locales/es.ts`.
Tests: `src/tests/main/updater.install.test.ts`,
`src/tests/main/updateMarker.test.ts` (new),
`src/tests/renderer/useAutoUpdater.test.tsx` (new).
Build: `build/installer.nsh` (new), `package.json` (nsis config only).
Docs: `README.md`, `odd/tasks/update-ux.md`.
Anything else needs the user's authorization first.

## Design decisions
| # | Decision | Rationale |
|---|---|---|
| D1 | Show determinate progress for **download only** | The app is dead during install; no event exists. Recorded in Problem. |
| D2 | Persist a marker file in `app.getPath('userData')` (`pending-update.json`) | No DB migration; survives the process swap; trivially clearable. |
| D3 | Cleared on first `get-update-result` read | One-shot confirmation; no stale toasts. |
| D4 | Keep `quitAndInstall(true, true)` | Correct args already; the gap is the assisted-installer relaunch, fixed in NSIS (D5). |
| D5 | Custom NSIS include with `customFinishPage` that force-runs on `${isUpdated}` | Community-proven fix for #5792; keeps `oneClick: false` + install-dir picker. |
| D6 | Delay the install call ~1.2 s from the renderer | Shows intent before the app closes; bounded and testable. |

## Tasks
| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| UPD-01 | Main: forward `download-progress`; write pending marker on explicit install; add `get-update-result` IPC; preload method | `src/main/updater.ts`, `src/main/updateMarker.ts` (new), `src/main/preload.ts` | delegated direct (one writer) | [ ] |
| UPD-02 | Renderer hook: download percent/speed, `installing` status + delayed install, post-restart result fetch | `src/renderer/hooks/useAutoUpdater.ts` | delegated direct (same writer) | [ ] |
| UPD-03 | Renderer UI: determinate progress + install overlay in NavBar; post-restart toast; i18n es/en | `src/renderer/components/NavBar.tsx`, `src/renderer/locales/en.ts`, `src/renderer/locales/es.ts` | delegated direct (same writer) | [ ] |
| UPD-04 | Tests: marker unit, extended packaged-install suite, renderer hook | `src/tests/main/updateMarker.test.ts` (new), `src/tests/main/updater.install.test.ts`, `src/tests/renderer/useAutoUpdater.test.tsx` (new) | delegated direct (same writer) | [ ] |
| UPD-05 | NSIS relaunch fix: custom include + config | `build/installer.nsh` (new), `package.json` | direct inline | [ ] |
| UPD-06 | Docs: README v1.13.0 plan + this document | `README.md`, `odd/tasks/update-ux.md` | direct inline | [ ] |

## Acceptance criteria
- While downloading, the UI shows a real percentage that advances; it is not a
  decorative animation.
- Clicking "Install" shows a blocking "Installing / the app will restart"
  overlay, then calls `installUpdate` after a bounded delay.
- If the app comes back on the new version (or the user opens it later), it shows
  "Updated to vX" exactly once and clears the marker.
- On a packaged build updating a real installed version, the app relaunches on
  its own after a silent install.
- Unit tests fail if progress is not forwarded, if the marker is not written
  before `quitAndInstall`, or if `quitAndInstall` is called with anything other
  than `(true, true)`.
- `npm test`, `npm run type-check`, `npm run lint`, `npm run build` are green.
- Packaged relaunch verification is manual and recorded in this document.

## Delivery strategy
- **`single-pr`** to `staging` (repo convention: every prior phase shipped as one
  PR to staging).
- Forecast: ~550 authored changed lines (additions + deletions, generated files
  excluded), spread across two work-unit commits (UX slice, then NSIS slice).
  Over the ~400 planning heuristic, which is why the strategy is recorded
  explicitly rather than left implicit.

## Route log
| Task group | Route | Trigger evidence |
|---|---|---|
| UPD-01..04 | delegated direct (one writer) | Multi-file, non-trivial: main + preload + hook + UI + i18n + tests |
| UPD-05 | direct inline | Two files, design resolved by D5; config + a script |
| UPD-06 | direct inline | Mechanical documentation |

## Progress
- 2026-10-03 — Feature document created after a read-only map of the update flow
  and an empirical check of `electron-updater@6.8.9` / `app-builder-lib@26.15.3`
  against `node_modules`. No source file written yet.
- 2026-10-03 — UPD-01..04 implemented by one bounded writer; UPD-05 and UPD-06
  applied inline by the parent. Verification is green (see Evidence). The NSIS
  installer build succeeded with the custom include, proving `build/installer.nsh`
  compiles and is picked up by electron-builder. Only the packaged, end-to-end
  relaunch check remains (manual, needs a real update).
- 2026-10-03 — Work-unit commits on `feat/update-ux`: `590bbc5`
  (feat: download progress + post-restart confirmation + tests), `a0d317b`
  (fix: NSIS assisted-installer relaunch), `fb76412` (docs: track + roadmap).
- 2026-10-04 — **V6 verified (manual, real client):** on the `1.13.0` update the user waited without acting
  and the packaged app relaunched by itself after a few seconds — the assisted-installer relaunch the NSIS
  fix targets, observed end to end. No further E2E release is required.

## Findings during implementation
| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | Adding the `get-update-result` IPC handler broke `src/tests/main/updater.test.ts:51`, which asserted exactly 2 registered handlers. That file was outside the writer's authorized surfaces. | `npm test` red: `expected 2, got 3` | Parent updated the assertion to 3 and added a per-channel check |
| F2 | The "Reiniciar ahora" toast action called `window.Main.installUpdate` directly, bypassing the new `installing` overlay. | `src/renderer/hooks/useAutoUpdater.ts` | Routed through the hook's `installUpdate` so the overlay is shown |
| F3 | `nsis.include` resolves relative to `buildResources` (`resources/`) first, then projectDir. | `app-builder-lib/out/platformPackager.js:582-608` | Placed at `build/installer.nsh`; resolved via projectDir; confirmed by a successful installer build |

## Evidence
| # | Check | Command | Result |
|---|---|---|---|
| V1 | Unit + integration suite | `npm test` | 285/285 passed |
| V2 | Types | `npm run type-check` | clean |
| V3 | Lint | `npm run lint` | 0 errors, 82 pre-existing warnings |
| V4 | Production build | `npm run build` | success |
| V5 | NSIS installer compiles with the custom include | `npx electron-builder --win --publish never` | `TW Time Register Setup 1.12.0.exe` built; no makensis or resource error |
| V6 | Packaged relaunch, end to end | manual: update a real client to `1.13.0` | **PASS** (2026-10-04): the user updated a packaged client to `1.13.0`, waited without acting, and the app relaunched by itself after a few seconds |
