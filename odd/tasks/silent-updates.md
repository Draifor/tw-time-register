# Silent updates (v1.11.0) — VS Code style

## Objective

Make the app's update-install path **silent**: no NSIS wizard. The explicit "install now" action must
run the installer with `/S` and relaunch the app; the install-on-quit path that already exists must be
confirmed against the shipped code, documented, and covered by a test.

## Problem

`src/main/updater.ts:34` calls `autoUpdater.quitAndInstall()` **with no arguments**. In
`electron-updater@6.8.9` the signature is positional —
`quitAndInstall(isSilent = false, isForceRunAfter = false)` — so both flags are `false`, the installer
is spawned **without `/S`**, and the user gets the assisted NSIS wizard. The app quits, a wizard
appears, and the user has to click through an installer that the app was already supposed to have
handled. That is the gap the README's `v1.11.0` line names.

## Why

The README already carries the plan (`### v1.11.0 — Distribución & Actualizaciones`): *"Actualizaciones
silenciosas estilo VS Code: instalar sin el asistente NSIS (`/S`) al pulsar "Actualizar" o al cerrar la
app, con relanzado automático"*. It is the natural continuation of the `v1.10.0` work: the update
**transport** is now proven end to end (a real `1.9.0` client updated to `1.10.0`), so the remaining
friction is the install **presentation**.

## Scope

**In scope**

- The explicit install action (`ipcMain.handle('install-update')`) becomes silent and relaunches.
- A test for the production install path — which does not exist today (the current suite only covers
  the dev short-circuit).
- Documentation of the two install triggers and of the resolved meaning of "relanzado automático".

**Out of scope (deliberate)**

- **The version bump and the publish.** `1.11.0` and any tag/release remain separate human decisions.
- **Changing the NSIS config.** `oneClick: false` + `allowToChangeInstallationDirectory: true` stay as
  they are; `/S` is compatible with them (evidence below). Nothing here needs a config change.
- **`download-progress` plumbing.** No progress UI exists and none is added.
- **Clearing the 30 s / 4 h background-check timers** in `initAutoUpdater`. A real (small) leak, but a
  different slice; recorded under Findings instead of fixed here.
- **macOS/Linux.** Windows NSIS only, matching the repo's single supported platform.

## Constraints

- Windows-only target (`win.target: nsis`, x64). Silent NSIS semantics are Windows-specific.
- The app has **no** `before-quit` / `will-quit` handler and no tray: closing the window quits on
  non-darwin (`src/main/index.ts:143-145`). `quitAndInstall` therefore races nothing.
- A single-instance lock is active (`src/main/index.ts:21`); the spawned installer and the relaunched
  app must coexist with it. NSIS handles the app-exit wait itself.
- `autoUpdater.autoInstallOnAppQuit = true` is already set (`src/main/updater.ts:61`) and its quit
  handler is registered only after a download completes. **Do not change either** without evidence.
- Do not add a `Tray`, a close-confirmation dialog, or any quit interception: they are not part of this
  slice and they would change the app's shutdown contract.

## Verification mode

- **TDD: not enabled.** Nothing in the repo enables it (no `strict_tdd`, no testing-capabilities cache
  in Engram, no test-first instruction in `.github/copilot-instructions.md`). Tests and frameworks
  being present does not enable it, so the mode is **off by absence** — recorded, not assumed. Ordinary
  functional checks apply, and new behaviour gets tests alongside it, which is this repo's established
  convention (174/174 green at `v1.10.0`).
- **Test runner:** `npm test` → `vitest run`. Also `npm run type-check` (`tsc`), `npm run lint`
  (`eslint .`), `npm run build` (`vite build`).

## Authorized scope

- `src/main/updater.ts`
- `src/tests/main/updater*.test.ts`
- `README.md`
- `odd/tasks/silent-updates.md` (this document)

Anything outside this list needs the user's authorization first.

## Evidence — verified against the installed packages, not the docs

Read from `node_modules` at the installed versions (`electron-updater@6.8.9`,
`electron-builder`/`app-builder-lib@26.15.3`). This repo already learned the lesson once (F8/F9 in the
performance doc: verify driver behaviour empirically, never from upstream prose), so nothing below is
taken from documentation.

| # | Question | Answer | Evidence |
|---|---|---|---|
| E1 | What is the real signature of `quitAndInstall`? | **Positional booleans**, not an options object: `quitAndInstall(isSilent = false, isForceRunAfter = false)` | `electron-updater/out/AppUpdater.d.ts:200`, `out/BaseUpdater.js:13` |
| E2 | Does the 2nd argument matter when not silent? | **No — it is ignored.** `install(isSilent, isSilent ? isForceRunAfter : this.autoRunAppAfterInstall)` | `out/BaseUpdater.js:16` |
| E3 | What does the installer actually receive? | `args = ["--updated"]`, then `/S` **if** `isSilent`, then `--force-run` **if** `isForceRunAfter`, then `/D=<dir>` **only if** `installDirectory` is set | `out/NsisUpdater.js:107-117` |
| E4 | Is `/D=` passed by default? | **No.** `installDirectory` is declared optional and is **never assigned** by the library; it is only read. This app does not set it. | `out/NsisUpdater.d.ts:11`; only reads at `NsisUpdater.js:114,116` |
| E5 | Does a silent upgrade respect the folder the user already chose? | **Yes.** `setInstallModePerUser` reads `InstallLocation` from `HKCU\${INSTALL_REGISTRY_KEY}` and copies it into `$INSTDIR`, and this is **not** gated on `${Silent}`. `allowToChangeInstallationDirectory` is simply skipped in silent mode. | `templates/nsis/multiUser.nsh:25-28`; per-machine equivalent at `:75-77` |
| E6 | Does `/S` work with an **assisted** installer (`oneClick: false`)? | **Yes.** The template declares `SilentInstall silent` and every UI/page step is guarded by `${IfNot} ${Silent}`. | `templates/nsis/installer.nsi:31`; `installSection.nsh:5,18` |
| E7 | Does the relaunch work with the assisted installer? | **Only if BOTH `--force-run` and silent.** `# for assisted installer run only if silent, because assisted installer has run after finish option` → `${if} ${isForceRun}` **`${andIf} ${Silent}`**. | `templates/nsis/installSection.nsh:104-109` |
| E8 | Does closing the app already install silently? | **Yes, today, with no change.** `autoInstallOnAppQuit = true` (already set) registers a quit handler that calls `install(true, false)` — silent, and deliberately **without** relaunch. The handler is added after a download completes, and only runs when the exit code is 0. | `out/BaseUpdater.js:69-89` (`:88` is the call); app side `src/main/updater.ts:61` |
| E9 | Is `autoInstallOnAppQuit` still the v6 API? | **Yes.** `autoInstallEvent` (`"manual" \| "onQuit" \| "onNextLaunch"`) is a **v27** breaking change and does not exist here. | `out/AppUpdater.d.ts:31-36` |

**The consequence of E7 + E8 is the whole design.** The two triggers are not symmetric, and the code
must not pretend they are:

- **Explicit action** → `quitAndInstall(true, true)` → `/S --force-run` → silent install **and**
  relaunch. This is the change this slice makes.
- **On quit** → already `/S` with no `--force-run` → silent install, **no relaunch**. Relaunching an app
  the user just closed would be intrusive, so this stays as the library ships it.

### Resolved reading of "con relanzado automático"

The plan line attaches the relaunch to the install action without distinguishing the two triggers.
Resolved as: **the relaunch belongs to the explicit action only.** An app that relaunches itself after
the user closed it is a bug, not a feature. Recorded here as a decision, not an accident — if the
intended behaviour is different, it is a one-line change (`quitAndInstall(true, false)` or `(true,
true)`), and this document says so instead of leaving it implied.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| SU-01 | Make the explicit install silent and self-relaunching: `quitAndInstall(true, true)` in the `install-update` handler, with the reason recorded in a comment | `src/main/updater.ts` | direct inline (one line, design fully resolved by E1-E3, E7) | [x] `e84042e` |
| SU-02 | Cover the production install path: a test that drives `install-update` with `app.isPackaged = true` and asserts `quitAndInstall(true, true)` — today the suite only covers the dev short-circuit, so the shipped install arguments are untested | `src/tests/main/updater.install.test.ts` (new) | delegated direct (one writer) | [x] `e84042e` |
| SU-03 | Document both triggers in the README and check off the `v1.11.0` plan item | `README.md` | direct inline (mechanical) | [x] `e84042e` |
| SU-04 | Record results, evidence and residue in this document | `odd/tasks/silent-updates.md` | direct inline | [x] this document's own commit |

## Acceptance criteria

- Clicking the install action in a packaged build shows **no NSIS wizard**: the app quits, installs
  silently, and comes back on the new version.
- The installer is spawned with `/S --force-run` (`--updated` always first).
- Closing the app with a downloaded update still installs silently and does **not** relaunch.
- The new test fails if `quitAndInstall` is called with anything other than `(true, true)`.
- `npm run type-check`, `npm run lint` and `npm run build`: **green** (verified 2026-09-27).
- `npm test`: **181/182 pass.** The one failure is pre-existing and in a file this slice does not
  touch (see `F4`); the two updater files together are 5/5 green. This slice does **not** claim a green
  suite, and the reason is named rather than hidden.
- **Not verifiable here, and therefore not claimed:** that a packaged `1.11.0` build shows no wizard
  when the install action is pressed. That needs a release and a human at a keyboard, exactly like the
  `1.10.0` update path did. The README item stays unchecked for that reason.

## Findings during implementation (not in the plan)

| ID | Finding | Evidence | Disposition |
|---|---|---|---|
| F1 | The install-on-quit path was already silent and undocumented — the README plan implied both triggers needed work. | E8 | Documented (SU-03); no code change |
| F2 | `isForceRunAfter` is silently ignored when `isSilent` is false, so `quitAndInstall(false, true)` would look correct and do nothing. | E2 | Recorded; the test pins the exact argument pair so this cannot regress unnoticed |
| F3 | The 30 s `setTimeout` and 4 h `setInterval` in `initAutoUpdater` are never cleared and `initAutoUpdater` returns `void`, so a test that reaches production wiring would leave live timers behind. | `src/main/updater.ts:111-123` | Handled in the test with fake timers; the leak itself is left for its own slice |
| F4 | **A pre-existing test fails every Saturday and Sunday**, and it has nothing to do with this slice. `timeEntriesService.test.ts:339` asserts the suggestion is *today*, but `getNextAvailableSlot` correctly skips non-work days — `defaultSettings.workDays = [1,2,3,4,5]`, so Sunday (`7`) and Saturday (`6`) are skipped and the next Monday is returned. Observed on Sunday 2026-09-27: `AssertionError: expected '2026-09-28' to be '2026-09-27'`. This is the same family as the performance doc's `F1`: an implicit assumption about what "today" is. The suite already contains a weekend-aware helper at `:383`, so this one test simply lacks the guard. | Failing assertion `src/tests/main/services/timeEntriesService.test.ts:339`; work days at `:39`; the skip loop it disagrees with at `src/main/services/timeEntriesService.ts:419-427` | **Outside this slice's authorized scope → deliberately not fixed.** Recommended fix: expect today when `workDays.includes(localDayOfWeek(today))`, else the next work day. Needs the user's authorization. |
| F5 | `services.integration.test.ts` can fail **flakily** when the suite runs in parallel: it races `database.integration.test.ts` on the one-time Electron binary download (`failed to create directory ...\node_modules\electron\dist\locales: already exists`, surfacing as `Electron failed to install correctly`). Observed once during this slice; it passed in isolation and in the final full run. | Writer's run vs. the orchestrator's final full run | Recorded only. Not reproducible on demand and not caused by this change, but worth knowing before treating a red full-suite run as a regression. |

## Route log

| Task group | Route | Trigger evidence |
|---|---|---|
| SU-01 | direct inline | one line; no research or design left after E1-E3/E7 |
| SU-02 | delegated direct (one writer) | new non-trivial test file; needs module re-import with a different mock — reading that prepares a write |
| SU-03, SU-04 | direct inline | mechanical documentation |

## Progress

- 2026-09-27 — Feature document created, after a read-only map of the whole update flow and an
  empirical verification of `electron-updater@6.8.9` and `app-builder-lib@26.15.3` against
  `node_modules` (E1-E9). No source file has been written yet.
- Delivery strategy: `ask-on-risk`. Forecast: well under the ~400 authored-line budget (one production
  line, one test file, docs), so no chaining is expected.
- 2026-09-27 — **SU-01..SU-04 executed** (`e84042e`, code + tests + README together; this document in
  its own commit). Production change is one call: `autoUpdater.quitAndInstall(true, true)`. New file
  `src/tests/main/updater.install.test.ts` (2 tests) is the first coverage of the production install
  path; it mocks `app.isPackaged: true`, reloads the module per test with `vi.resetModules()` to defeat
  the module-level "register once" guards, and uses fake timers to contain F3.

  Verification, run by the orchestrator on the final tree:
  - `npx vitest run src/tests/main/updater.install.test.ts src/tests/main/updater.test.ts` → **5/5 pass**.
  - `npm test` → **181 passed / 1 failed (182)**. The failure is `F4`, pre-existing, in a file this
    slice does not touch; `git diff --name-only` on the working tree confirmed only `src/main/updater.ts`
    changed production code.
  - `npm run type-check` → clean. `npm run lint` → clean. `npm run build` → OK (main 505.02 kB, preload
    7.43 kB; the `Unknown input options: platform` line is `vite-plugin-electron`'s pre-existing S6
    warning, not from this change).

  The writer proved the new test is **not vacuous** by flipping the assertion to
  `(true, false)` and observing it fail, then restoring it; the orchestrator re-ran the file afterwards
  to confirm the restored state is green.

  Authorized source changes only: `src/main/updater.ts` + the new test. `README.md` carries the
  user-facing description. Nothing was bumped, tagged, published or reviewed — those remain separate
  human decisions.
- 2026-09-27 — **Residue.** The packaged behaviour ("press install → no wizard → app comes back on the
  new version") is **not yet observed**; it needs a `1.11.0` release and a human at a keyboard, the same
  way the `1.10.0` update path needed one. `F4` is red in the suite and awaits authorization. `F3` and
  `F5` are recorded, not fixed.
