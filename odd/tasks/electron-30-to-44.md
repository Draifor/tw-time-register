# ODD Feature — Electron 30 → 44 (security-driven platform upgrade)

> Migration plan built from the **official breaking-changes document** (majors 31→44)
> cross-checked against an exhaustive audit of this codebase. Every impact below has
> evidence; nothing is inferred from memory.

- **Feature:** `electron-30-to-44`
- **Branch:** `staging`
- **Created:** 2026-09-25
- **Driver:** Electron 30 is **end-of-life**. Only the latest three majors receive
  security fixes. This app stores credentials via `safeStorage` and calls the
  TeamWork API, so an unpatched Chromium/Node is a real exposure, not a nice-to-have.

## Scope

In: `electron`, `better-sqlite3`, `electron-builder`, `electron-updater`,
`electron-is-dev`, the packaging/CI path, and the two app-level behaviour fixes the
jump requires.

Out: React 19, Tailwind 4, Vite 8, TypeScript 7. Those are separate tracks.

## Verified impact map

| Major | Official change | Impact here | Evidence |
|---|---|---|---|
| 31 | WebSQL removed; `nativeImage.toDataURL` colorspace; `flashFrame` on macOS | **none** | no usage |
| 32 | **`File.path` removed** → `webUtils.getPathForFile` | **none** — 0 usages. Both file inputs read content with `FileReader`, never the native path | `ImportCSVTasksDialog.tsx:106,219`, `TaskCommentDialog.tsx:368`; grep `file.path` = 0 |
| 32 | `databases/` dir in `userData` deleted | **none** — the DB is `worktime.sqlite` at the `userData` root, not under `databases/` | `database.ts:101-103` |
| 32 | navigation-history APIs moved to `navigationHistory` | **none** | no usage |
| 33 | **Native modules require C++20** | **ACTION** — `better-sqlite3` must move to a version with C++20 builds for the new ABI | `package.json:56`; rebuilt by `electron-builder install-app-deps` (`release.yml:77`, `build-local.ps1:29`) |
| 33 | macOS 10.15 dropped | release note | — |
| 34 | Menu bar hidden during fullscreen on Windows | **none** — frameless window, no menu bar | `index.ts:52` (`frame: false`) |
| 35 | `console-message` args; `WebRequestFilter.urls`; `session.setPreloads`; `isAeroGlassEnabled` | **none** | no usage |
| 36 | `app.commandLine` lowercases switches | **none** | no usage |
| 36 | GTK 4 default on GNOME (Linux) | Linux release note | — |
| 37 | utility-process unhandled rejection; WebUSB/Serial blocklist; `ProtocolResponse.session = null` | **none** | no usage |
| 38 | macOS 11 dropped; Wayland becomes the default on Wayland sessions; `plugin-crashed` removed | Linux/macOS release note | — |
| 39 | `window.open` popups always resizable | **none** — 0 usages | grep = 0 |
| 40 | `clipboard` deprecated in the renderer | **none** | grep = 0 |
| 41 | `showHiddenFiles` on Linux; PDFs no longer a separate `WebContents` | **none** | no usage |
| 42 | **`electron` no longer downloads itself in `postinstall`** — it downloads on the first `bin` run; `ELECTRON_SKIP_BINARY_DOWNLOAD` removed | **ACTION** — the packaging/CI path must tolerate lazy download | `release.yml:74-77`, `build-local.ps1:29` |
| 42 | macOS notifications migrated to `UNNotification` (requires code-signing) | **none** — no `Notification` usage | grep |
| 43 | **`dialog.showOpenDialog`/`showSaveDialog` default to Downloads when `defaultPath` is omitted** (the OS no longer restores the last directory) | **ACTION — real UX regression.** Backup export/import call the dialogs with no `defaultPath` | `backupService.ts:19,44` |
| 43 | Frameless windows default to rounded corners on Linux | optional — pass `roundedCorners: false` to preserve current look | `index.ts:52` |
| 44 | **`clipboard` removed from the renderer**; module rearchitected to promises | **none** — 0 usages | grep = 0 |
| 44 | Workers in subframes need `nodeIntegrationInSubFrames` | **none** — 0 `Worker` usages | grep = 0 |
| 44 | macOS 12 dropped → macOS 13+ required | release note; `dist:mac` exists | `package.json:29` |
| 44 | Windows `ia32` and Linux `armv7l` no longer published | **none** — the win target is `nsis`/`x64` only | `package.json:130-138` |
| 44 | ANGLE statically linked; `select-client-certificate` `webContents` may be null; Unity removed | **none** | no usage |

**Net:** the app's Electron API surface is small and none of the removed APIs are
used. The genuine risk is concentrated in the **native module**, the **packaging
path**, and **two app-level behaviour changes** (dialog default path, Linux corners).

## Package changes

| Package | Current | Target | Why |
|---|---|---|---|
| `electron` | 30.5.1 (`^30.0.7`) | 44.x | EOL → security |
| `better-sqlite3` | 11.10.0 (`^11.9.1`) | 13.x | new ABI + C++20 |
| `electron-builder` | 24.13.3 | 26.x | Electron 44 support |
| `electron-updater` | 6.8.3 | 6.8.9 | keep in step with the runtime |
| `electron-is-dev` | 2.0.0 | **remove** | deprecated; code already migrated (S1) |
| `vite-plugin-electron` | 0.29.0 | 1.x | evaluate separately (S6) |
| `@electron/rebuild` | 4.0.1 | 4.2.0 | minor |
| `@types/node` | 24.0.10 | 24.13.x | align with the runtime Node |

## Ordered slices (each independently revertable)

| Slice | Work | Risk |
|---|---|---|
| **S1 ✅ `ed07d9d`** | Replace `electron-is-dev` with `app.isPackaged` in `index.ts` + `updater.ts`; update the updater test mock. Behaviour-identical. | none |
| **S2 ✅ `de2af27`** | Fix the E43 dialog regression **before** the bump: track the last-used directory per dialog in `backupService` and pass it as `defaultPath`. Land it so the regression never ships. | low |
| **S3** | The version bump: electron 44.4.5, better-sqlite3 13.0.3, electron-builder 26.15.3, electron-updater 6.8.9. Two unplanned config changes were required (`npmRebuild: false`, `better-sqlite3` → `ignoredBuiltDependencies`). Code complete and installer built; **the packaged smoke test still needs a human**. | **high** |
| **S4 ✅ `c94f3da`+`649728a`** | Packaging/CI for the E42 lazy binary download; `build-local.ps1` plus the CI-equivalent packaging commands produce a working installer on a clean checkout with **no MSVC**. The workflow has since been executed once (`workflow_dispatch`, run `36263921639`, exit success, nothing published) — see the dry-run section. | medium |
| **S5** | Remove `electron-is-dev` from `package.json`; optional `roundedCorners: false`; record the macOS 13+ / Linux Wayland+GTK4 notes. | low |
| **S6** | Evaluate `vite-plugin-electron` 1.x as its own slice with its own rollback. | medium |

## S3 smoke-test checklist (the part that actually decides success)

1. Packaged app launches; the frameless window renders and the custom titlebar works.
2. SQLite opens at `userData/worktime.sqlite`; `runMigrations()` completes; existing
   data is intact; the indexes and PRAGMAs are present.
3. `PRAGMA foreign_keys` = 1 and the cascade still behaves.
4. Backup export → save dialog; backup import → open dialog.
5. TeamWork credentials decrypt (`safeStorage`) and a sync round-trip works.
6. Auto-update check runs; and separately, an already-installed 1.9.0 (Electron 30)
   client updates to the Electron 44 build and launches.
7. `dist:win` output installs on a clean machine.

## Rollback

- Every slice is one commit on `staging`; `git revert <sha>` for S1/S2/S5. S4 is two
  commits (`c94f3da` pipeline, `649728a` the references it made false); revert both.
- S3: restore the previous versions in `package.json`, check out the pre-bump
  `pnpm-lock.yaml`, and re-run `install-app-deps`. For a rollback *install*, use the
  published `v1.9.0` release asset (`TW-Time-Register-Setup-1.9.0.exe`, 2026-09-23) —
  `release/` is overwritten by the next build, so it is not a rollback store.
- The schema is unchanged by this upgrade, so a downgrade does not corrupt data.

## Known risks

- **S3 has no incremental step between 30 and 44.** Mitigation: the API surface audit
  is exhaustive and none of the removed APIs are used, so the exposure is the native
  module plus packaging, not application code.
- **Auto-update is the highest-consequence path.** A 14-major jump delivered to
  installed clients must be proven end to end, not assumed.
- `webPreferences` leaves `sandbox` and `contextIsolation` at their defaults (already
  the secure values), and the preload uses **no Node built-ins** — keep it that way;
  adding Node usage to the preload would break under the sandbox.
- Mixed package manager (F6): `pnpm-lock.yaml` + pnpm 10 are authoritative, but
  `.npmrc` is pnpm syntax that npm misparses. Regenerate the lockfile with **pnpm**,
  not npm, and never hand-edit it.

## Progress

- 2026-09-25 — Reconnaissance complete: official breaking changes 31→44 mapped against
  an exhaustive code audit; every app-specific impact has evidence. S1 landed.
- 2026-09-25 — **S2 landed** (`de2af27`). `backupService` now remembers the folder
  chosen in each dialog (export and import tracked independently) and passes it
  explicitly as `defaultPath`, falling back to `app.getPath('documents')`. E43's
  "no `defaultPath` → Downloads" regression can no longer ship. Deliberately
  **session-scoped**: it restores the pre-43 convenience without adding a new
  persistence surface (the alternative — a `work_settings` row — would couple a
  low-risk fix to the migration file S3 is about to churn). Covered by
  `src/tests/main/services/backupService.test.ts` (4 cases: first-use default,
  remembered folder, cancel keeps the folder, export/import independence).
  Gates: `pnpm exec vitest run` **174/174**, `pnpm run type-check` clean,
  `pnpm run lint` clean. Route: direct inline (one production file + its test,
  design fully resolved after reading the service, migrations and existing test
  conventions).
- 2026-09-25 — **S3 preparation corrected against live evidence.** Three claims
  were checked and one of them was wrong: (a) Electron 44.4.5 is still the current
  stable major, so the plan has not drifted; (b) the rollback artifact is the
  published `v1.9.0` installer — `release/` holds no installer at all and is
  overwritten by the next build; (c) the earlier note claiming the test harness is
  pinned to the Electron 30 ABI was **incorrect** — the harness resolves
  `require('electron')`, so it follows the installed version and needs no change.
- 2026-09-25 — **Packaged smoke test confirmed by the user** on
  `release\win-unpacked\TW Time Register.exe`: the app launches and runs cleanly,
  backup export/import dialogs behave (the S2 fix, including the `defaultPath`
  directory), and `safeStorage` credential decryption plus a TeamWork sync
  round-trip work under Electron 44. Still unverifiable without publishing:
  auto-update (point 6) and clean-machine install (point 7).
- Next: **S4** (packaging/CI) — full work order below. Do not bump the app version
  or publish before it lands.
- 2026-09-25 — **S3 executed.** Versions bumped, installer built, all automated gates
  green on Electron 44; two config changes the plan did not anticipate were required
  (see the S3 section below). Blocked on the human packaged smoke test before it can
  be called done, and the review preflight is deliberately deferred until the
  candidate bytes are final.
- Next: the packaged smoke test (points 1 and 4-7 above), then the review preflight,
  then **S4** (packaging/CI: the `install-app-deps` call sites and the redundant
  `@electron/rebuild` dev dependency).
- 2026-09-26 — **S4 executed.** Six work-order items landed in `c94f3da`; the
  references S4 made false were corrected in `649728a`. The clean-checkout proof ran on
  this machine, which has **no MSVC**, and passed end to end: installer 128.96 MB, zero
  native compilation, no publish. Full evidence and follow-ups in the S4 section below.
- 2026-09-26 — **The dry run executed and passed** (`workflow_dispatch`, run `36263921639`,
  conclusion success, nothing published). Full evidence in the dry-run section at the end.
  This closes R3-dispatch-branch-unverified and completes carry-forward item 4.
- Next (2026-09-26, after the dry run): the S4 slice is approved and its authority burned.
  Order of work for the next session:
  1. ~~run a `workflow_dispatch` dry run (no publish)~~ — **done** (run `36263921639`:
     `Package and publish` skipped, `Package without publishing` + artifact upload ran,
     no new release);
  2. the carry-forward items 1-3 in the review section below (item 4 was the dry run, now done);
  3. the **S1/S2/S3 review gap** — **decided**: one transaction over `fd7cfcc..63c9666`
     covering all three slices (2075 lines / 9 files, medium, `slice_budget_reached`),
     not three transactions. Evidence in the dry-run section;
  4. then S5, then S6.
  The version bump and the publish itself remain separate decisions.

  **Ordering hazard:** carry-forward items 1-3 edit `release.yml` and `build-local.ps1`, so
  the dry run above proves the **S4** pipeline only. Once they land the pipeline changes and
  must be dry-run again before any publish. — **Settled 2026-09-26**: the fresh dispatch dry
  run was executed against the gated workflow (run `36277299134`); see the dry-run section at
  the end of this document.

## S3 — executed (automated gates green; human smoke test confirmed)

Landed versions, resolved against the registry on 2026-09-25:

| Package | From | To |
|---|---|---|
| `electron` | 30.5.1 | **44.4.5** |
| `better-sqlite3` | 11.10.0 | **13.0.3** |
| `electron-builder` | 24.13.3 | **26.15.3** |
| `electron-updater` | 6.8.3 | **6.8.9** |
| `@electron/rebuild` | 4.0.1 | 4.2.0 |

### Two config changes the plan did not anticipate

**1. `pnpm-workspace.yaml`: `better-sqlite3` moved from `onlyBuiltDependencies` to
`ignoredBuiltDependencies`.** better-sqlite3 13.x declares **no `install` script**.
It ships Node-API prebuilds (`prebuilds/<platform>-<arch>.node`, flat files) and
loads them directly from `lib/binding.js`. pnpm still classified it as requiring a
build because of `gypfile: true` / `binding.gyp`, and ran `node-gyp rebuild`, which
aborts at configure time on a machine without MSVC — before better-sqlite3's own
`binding.gyp` prebuild detection can run.

**2. `package.json` → `build.npmRebuild: false`.** `@electron/rebuild` cannot
recognise better-sqlite3 13's prebuild format. `Prebuildify.usesTool()` requires a
`prebuildify` entry in `devDependencies` (absent) *and* a
`prebuilds/<plat>-<arch>/electron.napi.node` layout (better-sqlite3 uses flat
`prebuilds/win32-x64.node`); `NodePreGyp` and `PrebuildInstall` require
dependencies that are also absent. So it falls through to `node-gyp` and fails.
With `npmRebuild: false`, electron-builder logs
`skipped dependencies rebuild reason=npmRebuild is set to false` and packages the
shipped prebuild.

**Tradeoff accepted:** `npmRebuild: false` removes the automatic native rebuild for
*every* module. That is correct today because better-sqlite3 is the app's only
native dependency and — being Node-API — needs no rebuild. If a future dependency
does need one, this flag must be revisited: a Node-ABI binary would fail only in
the packaged app, never in dev.

The alternative considered and rejected was installing MSVC Build Tools
(2-6 GB, admin, on every dev machine and CI runner) to compile a binary that
upstream already publishes and tests. `electron-builder` exposes no per-module
rebuild exclusion — only the global `npmRebuild`, `nodeGypRebuild` and
`buildDependenciesFromSource`.

### Also fixed: a stale `node-abi`

`install-app-deps` first failed with `Could not detect abi for version 44.4.5 and
runtime electron`. The lockfile had pinned `node-abi@4.12.0` (which satisfies
`@electron/rebuild`'s `^4.2.0`); `4.35.0` is published and computes ABI **149** for
Electron 44.4.5. `pnpm update node-abi` moved it — a lockfile-only change inside
the already-declared range.

### Verified

| Check | Result |
|---|---|
| `pnpm exec vitest run` | **174/174**, including both Electron-as-Node integration suites, so those ran on Electron 44 |
| `pnpm run type-check` / `lint` / `build` | all clean (renderer 858 kB, main 505 kB, preload 7.4 kB) |
| `pnpm exec electron --version` | `v44.4.5`, preceded by `Downloading Electron binary...` — **E42's lazy download confirmed live** |
| Packaged layout | `app.asar` + `app.asar.unpacked/node_modules/better-sqlite3/prebuilds/win32-x64.node`, i.e. outside asar as required |
| Packaged runtime probe | the packaged binary under `ELECTRON_RUN_AS_NODE=1` loaded the packaged better-sqlite3 and round-tripped a row: `electron 44.4.5, node 24.21.0, napi 10, abi 149` |
| `pnpm run dist:win` | `release/TW Time Register Setup 1.9.0.exe`, 135 MB, plus `.blockmap` and `latest.yml` |

The Electron-as-Node harness needed **no change**, for a different reason than
first assumed: it resolves the runner with `require('electron')`, which returns
whichever version is installed, and better-sqlite3 13's prebuild is ABI-stable
across Node and Electron anyway.

Note: **Electron 44 ships Node 24.21.0** while the dev runtime is Node 22.17.0, so
the main process runs on Node 24 in the packaged app. `@types/node` at `^24.x` is
therefore the right target, consistent with the plan.

### Still open before S3 can be called done

Smoke-test points 1 and 4-7 need a human at the keyboard: window and custom
titlebar, backup export/import dialogs, `safeStorage` credential decryption plus a
sync round-trip, the auto-update path including an installed 1.9.0 (Electron 30)
client upgrading, and a clean-machine install.

The review preflight is deliberately **not** run yet. A smoke-test finding would
change the candidate bytes, and freezing a review transaction on bytes that may
still move would waste it.

## S4 — executed (packaging/CI)

**Objective:** make the release pipeline match the new dependency reality and prove
it on a clean checkout, **without publishing to installed clients**.

**Files:** `.github/workflows/release.yml`, `build-local.ps1`.

**Before starting:** close any running copy of the packaged app — it holds a lock on
`release/win-unpacked` and the next build cannot overwrite it.

1. **Remove the obsolete native rebuild.** Delete the `install-app-deps` step
   (`release.yml:77`) and its call in `build-local.ps1:29`. Verified on 2026-09-25:
   better-sqlite3 13.0.3 is Node-API with shipped prebuilds and needs no rebuild, and
   the explicit `electron-builder install-app-deps` command **ignores
   `npmRebuild: false`** — it still runs `node-gyp rebuild`. Locally that fails with
   `Could not find any Visual Studio installation to use`; on `windows-2022` MSVC
   *is* present, so there it would compile from source and silently replace the
   tested upstream prebuild with a runner-built binary.
2. **Stop rewriting `.npmrc` with build-dependency settings.** `release.yml:59-69`
   and `build-local.ps1:15-22` both overwrite `.npmrc`, putting `better-sqlite3`
   back into `onlyBuiltDependencies` and undoing the `pnpm-workspace.yaml` fix from
   S3. On a clean checkout, establish whether pnpm 10 still reads
   `onlyBuiltDependencies` and `node-linker` from `.npmrc` or only from
   `pnpm-workspace.yaml`. If the latter, move the CI packaging config into
   `pnpm-workspace.yaml` and delete the `.npmrc` rewrite. Note that
   `node-linker=hoisted` **is** still required for electron-builder — preserve that
   behaviour however it ends up configured.
3. **Split publish from build.** `workflow_dispatch` already exists
   (`release.yml:7`) but the build step runs `--publish always` (`release.yml:82`),
   so a manual dispatch publishes to every installed client. Make manual dispatch
   build and upload a workflow artifact with no publish; keep publishing on tag push
   only. This is what allows proving the pipeline without any client pulling it.
4. **Drop the redundant `@electron/rebuild` devDependency.** electron-builder warns
   it `already used by electron-builder, please consider to remove excess dependency
   from devDependencies`.
5. **Confirm E42 lazy-download tolerance.** Electron no longer downloads itself in
   `postinstall`; the first binary use triggers it (confirmed live: `pnpm exec
   electron --version` printed `Downloading Electron binary...`). Check neither
   script assumes `node_modules/electron/dist` exists right after `pnpm install`,
   and keep `ELECTRON_GET_MAX_RETRIES` (`release.yml:73`).
6. **Prove it end to end on a clean checkout:** fresh clone → `pnpm install` → build
   → installer, on this machine (which has **no** MSVC, so it is the strictest case).
   A run that succeeds only because a toolchain happens to be present has not been
   proven.

**Out of scope for S4:** the app version bump and the publish itself. Both are
separate decisions taken after S4 lands.

### Cleanup noted for later slices

- `bindings` and `file-uri-to-path` are still listed in `build.files` and
  `asarUnpack` but were dependencies of better-sqlite3 11 only; they are absent from
  the packaged output → S5.
- `vite`, `vite-plugin-electron`, `vite-plugin-electron-renderer` and
  `@vitejs/plugin-react` live in `dependencies` though they are build-time tools.
  That is why electron-builder reports missing platform-specific `@esbuild/*` and
  `@rollup/rollup-*` binaries during packaging → S5.

## S4 — results (2026-09-26)

Commits: `c94f3da` (the pipeline), `649728a` (the references S4 made false).

| Work-order item | Result |
|---|---|
| 1. Remove the obsolete native rebuild | `install-app-deps` deleted from `release.yml` and `build-local.ps1`. The clean-checkout log confirms the intended path: `skipped dependencies rebuild reason=npmRebuild is set to false`. |
| 2. Stop rewriting `.npmrc` | Rewrite deleted from both call sites. Measured on pnpm 10.28.2, not assumed: pnpm reads `node-linker` from `.npmrc` **and** from `npm_config_node_linker`, but reads `onlyBuiltDependencies` **only** from `pnpm-workspace.yaml` — a valid-INI `onlyBuiltDependencies=…` in `.npmrc` resolves to `undefined`. So the CI block was inert for build deps and only achieved `node-linker`; that now travels as `npm_config_node_linker=hoisted`, which preserves the isolated-dev / hoisted-packaging split. `.npmrc` is comment-only: its old YAML-style block was parsed as junk keys (`better-sqlite3=true`, `onlyBuiltDependencies:=true`), which is what emitted the "Unknown project config" warnings. |
| 3. Split publish from build | `workflow_dispatch` now runs `electron-builder --win --publish never` and uploads via `actions/upload-artifact`; only a `push` on `v*` runs `--publish always`. `GH_TOKEN` is scoped to the tag step alone. |
| 4. Drop `@electron/rebuild` | Removed with `pnpm remove`; the lockfile diff is exactly 3 lines inside `importers`. It remains in the graph as a transitive dependency of `electron-builder`. |
| 5. Confirm E42 lazy-download tolerance | Neither script assumes `node_modules/electron/dist` exists. Confirmed live on the clean checkout: `dist` and `path.txt` are **absent** after `pnpm install`, and packaging still succeeds because electron-builder downloads electron itself. `ELECTRON_GET_MAX_RETRIES` moved from the install step to job-level `env:` — with a lazy first-use download it was previously set at a moment when nothing downloads. |
| 6. Prove it end to end on a clean checkout | Done on this machine, which has **no MSVC** (`cl.exe` not found, no `vswhere`). |

### Clean-checkout proof

Clone of `649728a` at `C:\Users\…\Temp\opencode\s4-clean`, left in place as evidence.
Before the build the clone was clean: `git status` empty, no `node_modules`, no `release/`.

| Check | Result |
|---|---|
| `build-local.ps1` | exit **0**: `fnm use 22.17.0` → hoisted install → `pnpm build` → `--dir --publish never` |
| Native compilation | **none** — no `node-gyp` / `gyp info` / `gyp ERR!` / `MSBuild` / `Visual Studio` lines. Only `esbuild`'s prebuilt-binary postinstall ran. |
| `better-sqlite3` prebuild | present at `node_modules/better-sqlite3/prebuilds/win32-x64.node`; Node round-trip returned `{"a":42}` |
| Hoisted layout | `.modules.yaml` → `nodeLinker: hoisted`; packages resolve as real directories, not symlinks |
| Installer | `release/TW Time Register Setup 1.9.0.exe`, **128.96 MB** (+ `.blockmap`, `latest.yml`), exit 0, **no GitHub contact**, no publish attempt |
| Packaged native module | `resources/app.asar.unpacked/node_modules/better-sqlite3/prebuilds/win32-x64.node` present, i.e. outside asar |

**Correction to this slice's own acceptance criterion:** "`node_modules/.pnpm` must not
exist" is wrong for pnpm 10 — it always writes `.pnpm/lock.yaml` even under
`nodeLinker: hoisted`. The correct signal is the `.modules.yaml` linker value plus real
(non-symlink) package directories. Recorded so a future run does not chase a false failure.

**Not covered here:** the workflow itself was only YAML-validated and hand-reviewed. No
GitHub Actions run was executed, so `workflow_dispatch` behaviour (artifact upload,
`GH_TOKEN` scoping) stays unproven until the first real dispatch. No publish was
performed, and the app version bump remains out of scope.

**Security note found while proving this — not caused by this repo.** This machine has
`NODE_TLS_REJECT_UNAUTHORIZED=0` set as a persistent **User** environment variable, so
every local npm/pnpm/electron download ran with TLS certificate verification disabled.
CI is unaffected (fresh runner; the variable is User-scoped only) and package integrity
is still enforced by the lockfile's `sha512` hashes, but it should be removed from this
machine.

### Follow-ups found during S4

- `src/tests/main/services/timeEntriesService.test.ts:339` is date-dependent and
  **pre-existing**: it asserts "today", but `getNextAvailableSlot` skips days outside
  `settings.workDays` (`[1,2,3,4,5]`), so it fails on every Saturday/Sunday run. Every
  sibling test in that file advances past non-work days with a `while`; this one does
  not. It is a latent weekend CI flake, unrelated to S4. Fix: freeze the clock
  (`vi.setSystemTime` on a weekday) or assert the "next work day" contract.
- `electron` no longer declares a `postinstall` (nothing ran for it during the clean
  install), so its entry in `pnpm-workspace.yaml:onlyBuiltDependencies` is now inert —
  the same reason `better-sqlite3` moved to `ignoredBuiltDependencies` → S5.
- `.github/copilot-instructions.md` still carries drift that S3/S4 did not own:
  it says `asar: false` while `package.json` sets `asar: true`, says
  `better-sqlite3 11.x`, and says Node 24 has no N-API prebuilds (Node 24 is what
  Electron 44 ships). → S5.

## Review (receipt-driven development) — approved 2026-09-26

Transaction: lineage `review-ffea261f36319637`, base-ref `e146a32`, committed-only,
projection workspace, tier **high**. Scope was **the S4 slice only** — 8 files, 188
lines. Four lenses (risk, resilience, readability, reliability) were admitted; the final
admitted capture closed the review as **approved** with no correction opened, and the
acknowledgement burned authority (`gentle-ai.review-acknowledged/v1`,
`authority: burned`).

**The whole-branch candidate was refused first.** `review start` on the full unreviewed
range (55 files / 5240 lines since `aeb77d5`, 24 commits) returned
`lens_context_budget_exceeded` with `mutation_outcome: not_started` — no review authority
was created, so there was nothing to abandon or repair, and retrying that exact candidate
cannot succeed. The documented remedy is to reduce scope, which is why only S4 is
covered. Consequence: **S1, S2 and S3 remain unreviewed.** S3 alone is ~2100 lines
(lockfile-dominated) and may also exceed the budget; each slice needs its own transaction.

### Advisory findings (non-blocking)

None of these opened a correction and none reopens this review. They are later work, never
a reason to re-run the review on this candidate.

| ID | Lens | Location | Severity | Note |
|---|---|---|---|---|
| R1-001 | risk | `.github/workflows/release.yml:68` | WARNING | The release job installs with `--no-frozen-lockfile`, so a published installer can be assembled from versions resolved at build time rather than the committed lockfile. **Pre-existing** — the line is unchanged by this candidate. |
| R3-no-frozen-lockfile | reliability | `.github/workflows/release.yml:68` | WARNING | The same finding, reached independently. Pre-existing. |
| R4-5 | resilience | `.github/workflows/release.yml:68` | SUGGESTION | Consequence for rollback: reverting the lockfile restores source intent, not the dependency bytes that produced a published installer. Pre-existing. |
| R3-dispatch-branch-unverified | reliability | `.github/workflows/release.yml:80-94` | WARNING | The branch this slice adds (artifact globs, `if-no-files-found: error`, `--publish never`, no `GH_TOKEN`) has no executable verification. |
| R4-1 | resilience | `.github/workflows/release.yml:75` | WARNING | The rehearsal shares nothing with the publish branch at its point of failure, so the first run of `--publish always` is a real release with no retained artifact to fix forward from. |
| R4-2 | resilience | `.github/workflows/release.yml:70-71` | WARNING | Deleting the rebuild step removed the only build-time touch of the native module. Nothing now fails the build if the `win32-x64` prebuild is missing or ABI-incompatible; the first symptom would be a crash at database init on an installed machine. |
| R4-4 / R3-build-local-env-cleanup | resilience / reliability | `build-local.ps1:30` | SUGGESTION | The `finally` deletes `npm_config_node_linker` unconditionally instead of restoring a prior value, so a caller that had it set loses it silently. |
| R3-npmrc-approvals-relocated | reliability | `.npmrc:4-5` | SUGGESTION | Scope gap: the comment asserts the build-script approvals live in `pnpm-workspace.yaml`, a file outside this candidate, so the review could not see them. |
| R4-3 | resilience | `odd/tasks/electron-30-to-44.md:75` | SUGGESTION | The S4 row read as "verified" for a pipeline that was never executed, which would remove the prompt for a dispatch dry run. Wording corrected in the slices table above. |

### Carried forward (concrete, cheap) → S5 or its own slice

1. `--no-frozen-lockfile` → `--frozen-lockfile` in the release job; decide the same for
   `build-local.ps1`.
2. Capture and restore the previous `npm_config_node_linker` value in `build-local.ps1`.
3. Add a post-packaging native-module probe to CI (launch the packaged app, or round-trip
   `better-sqlite3` under `ELECTRON_RUN_AS_NODE`) so a broken prebuild fails the build
   instead of shipping — this restores what R4-2 correctly observes was lost.
4. Run a `workflow_dispatch` dry run **before** the version bump: it exercises the
   artifact-upload path and the mutually exclusive `if` guards without publishing.
5. Optional: let the rehearsal share more of the publish path (R4-1), and upload the
   installer artifact on the tag path too so a failed release can be fixed forward.

The reviewed candidate is `195236d`; this review record is a documentation-only follow-up,
so the receipt for the S4 code stands unchanged.

## Dry run — `workflow_dispatch`, executed 2026-09-26

Run `36263921639` — https://github.com/Draifor/tw-time-register/actions/runs/36263921639
Event `workflow_dispatch`, ref `staging` @ `e7b407b`, conclusion **success** (~4 min).

**Precondition that was not obvious:** the local branch was **25 commits ahead of
`origin/staging`**, and the remote `release.yml` was still the pre-S4 single-step
"Build and publish" with `--publish always`. A dispatch *before* the push would have run the
**old** workflow and published to installed clients — the exact outcome this dry run exists
to avoid. `staging` was fast-forwarded (`81d6d30..e7b407b`) and the remote file was verified
to contain `--publish never` + `upload-artifact` before dispatching.

| Step | Result |
|---|---|
| `Package and publish` (`if: push`) | **skipped** — the mutually exclusive guard holds |
| `Package without publishing` (`if: workflow_dispatch`) | success |
| `Upload installer artifact` | success |
| Artifact | `tw-time-register-windows`, 135 377 654 bytes (129,1 MB) |
| Releases after the run | unchanged — newest is still `v1.9.0` (2026-09-23) |

**Nothing was published.** This closes R3-dispatch-branch-unverified and completes
carry-forward item 4. It does **not** address R4-1: the publish branch (`--publish always`)
still shares only the build steps with the rehearsal, so its first real run remains a release
with no retained artifact — carry-forward item 5 is the fix for that.

### S1/S2/S3 gap — decision and evidence

`review assess` (read-only, one worktree per slice, RDD `on` / global):

| Candidate | Base-ref | Risk | Lines / files | `review_due` |
|---|---|---|---|---|
| S1 `ed07d9d` | `fd7cfcc` | medium | 14 / 3 | false (`under_budget`) |
| S2 `de2af27` | `02e984c` | medium | 158 / 2 | false (`under_budget`) |
| S3 `63c9666` | `0007fc6` | medium | 1730 / 3 | true (`slice_budget_reached`) |
| **S1+S2+S3** | `fd7cfcc` | medium | **2075 / 9** | true (`slice_budget_reached`) |

Two corrections to the earlier record: S3's tier is **medium** (`configuration_change` on
`package.json`), not high; and the `lens_context_budget_exceeded` refusal was against the
**whole branch** (55 files / 5240 lines), not the unreviewed prefix — that prefix is 2075
lines and fits comfortably.

**Decision:** one transaction over `fd7cfcc..63c9666` covering S1+S2+S3 together. It is a
distinct transaction with its own base and target, closes all three slices with real lenses,
and avoids three separate consent envelopes. The value is concentrated in S3: its 19
non-lockfile lines carry `npmRebuild: false`, which disables the automatic native rebuild for
*every* module — the least obvious and highest-consequence decision in the migration.

### S1/S2/S3 review — attempted, blocked by the runtime, terminal stop

Executed the decided transaction. It did **not** complete, and the gap stays open.

| Stage | Result |
|---|---|
| Consent (`gentle-ai.review-integration.consent/v3`) | granted by the user |
| `review start` | `action: created`, `state: reviewing`, lineage `review-44ad33de349f2aaa`, one lens `review-reliability`, correction budget 200 |
| Reviewer lens Task | `opencode_task_output_empty` — **attempt 1** |
| Exact-lineage STATUS | reoffered the same bound slot (`reviewer_results_required`, same `subject_hash`), so one relaunch was permitted |
| Reviewer lens Task | `opencode_task_output_empty` — **attempt 2** |
| `review capture-unachievable` | `recorded: true`, reason `reviewer_task_output_empty` |
| STATUS | **stop**, reason `unachievable_lens_slot`, `horizon: terminal` |

**No approval, no receipt, no burned authority, nothing delivered.** The provider stopped
terminally rather than closing over an unexecuted lens, so no hollow "approved" exists.

**Cause is not scope and not the budget.** The reviewer `provider_task.prompt` the runtime
materializes is binding + context + instruction + result schema + the changed paths' diffs;
it is materialized by the host from the binding line, not authored by the orchestrator
(proof: it carried the full 138-line content of `src/tests/main/services/backupService.test.ts`,
a file the orchestrator never read). The generated `pnpm-lock.yaml` is delivered as metadata
with no content hunk, so the payload was ~350 diff lines — small.

**This is a recurring runtime condition, not a one-off.** The same
`opencode_task_output_empty` was previously recorded at 5/5 attempts on lineage
`review-17eaa498cf6f9e2f` (the performance work). That is 7 consecutive empty reviewer
outputs across two unrelated transactions in this runtime. Both are OpenCode-side
(`opencode_task_output_empty`), so they are **not** a Gentle AI provider defect and no
upstream report applies.

**Remaining continuations** (from the provider's own stop table for `unachievable_lens_slot`):
withdraw with `--withdraw=true` and let the slot be reoffered (**only if transient** — the
evidence says it is not); or reduce scope and start a new `review start`; or disable
receipt-driven development at clone scope (`gentle-ai review mode disable --scope clone`) and
proceed under ordinary repository policy, carrying the existing evidence (per-slice `assess`,
174/174 on Electron 44, the human packaged smoke test) and this documented gap.

Until one of those is chosen, **S1, S2 and S3 remain unreviewed** - that is the honest state,
not a covered one.

### S3 reviewed alone — a real CRITICAL found, then abandoned by decision

The reduced-scope retry **worked where the 9-file candidate did not**: 3 files
(`package.json` + `pnpm-workspace.yaml` authored, `pnpm-lock.yaml` generated), ~19 authored
diff lines.

| Step | Result |
|---|---|
| `review assess` (base `0007fc6`) | medium, 1730 lines, `review_due: true` |
| `review start` (consent granted) | lineage `review-44bbfdb357ca3135`, one lens `review-reliability` |
| Reviewer lens Task | **admitted** — `gentle-ai.review-result-artifact/v2`, `admission_decision: completed` |
| Refuter (provider-required) | **corroborated** → `correction_required` |
| Correction plan | a bounded correction (1–200 lines) was required to close |
| Decision | accept the risk → `review abandon` committed; lineage quarantined |

**The finding:** `R3-NATIVE-REBUILD-DISABLED`, lens reliability, `package.json:113`, severity
**CRITICAL**, `evidence_class: inferential`, `causal_disposition: introduced`. `npmRebuild:
false` disables native-dependency rebuild for the whole packaged tree, not just
`better-sqlite3`; combined with the 30→44 jump in the same change, any non-Node-API packaged
runtime dependency ships a wrong-ABI binary and fails at application startup rather than at
build time. The candidate adds no packaging check or launch assertion proving the shipped
binaries load under the pinned Electron, and the generated lockfile is delivered without
content hunks, so the reviewer could not enumerate the native modules actually packaged.

**Why the risk was accepted** (explicit user decision, not an orchestrator call): the finding is
*inferential*, not deterministic - it is about the absence of a gate, not an observed failure.
For the current dependency set the direct evidence runs the other way: the packaged probe
recorded earlier in this document loaded the packaged `better-sqlite3` under Electron 44 and
round-tripped a row (`electron 44.4.5, node 24.21.0, napi 10, abi 149`), and the human packaged
smoke test passed. `better-sqlite3` is the only native runtime dependency. The reviewer also
could not see the lockfile *by design*, so its "unknown native module set" premise is a
limitation of the frozen input, not a discovered module.

**Consequence recorded honestly:** S3 has **no approval receipt**. It carries a corroborated
CRITICAL that is now an explicitly accepted risk — not a covered one. The reviewer's actionable
part is already carry-forward #3 in the S4 review section (a post-packaging native-module probe
in CI); that stays the right fix, and when it lands it should be reviewed on its own.

**Open scope reduction, unresolved:** the reviewer returned output at ~19 authored diff lines
after returning nothing at ~350. That is a real correlation but not proof — it could be size, or
it could be flakiness. Do not treat "reduce scope" as a settled remedy until it reproduces.

**Stale store state (needs a decision, not urgent):** three non-terminal lineages remain
`reviewing` in `.git/gentle-ai/review-transactions/v2/` — `review-17eaa498cf6f9e2f` (the
performance work, 5/5 empty reviewer outputs), `review-44ad33de349f2aaa` (the stopped
combined S1+S2+S3 attempt from this session) and `review-7c1048e2042af3ea`. Each needs its own
`review abandon` with a maintainer authorization binding.

## Carry-forwards 1-3 (S4 review) — execution

Task list created 2026-09-26 **before the first source write**, per the ODD tracking rule.

| ID | Task | Files | Status |
|---|---|---|---|
| CF-01 | Freeze the lockfile in the release job and in the local packaging script | `.github/workflows/release.yml`, `build-local.ps1` | done |
| CF-02 | Capture and restore the previous `npm_config_node_linker` instead of deleting it unconditionally | `build-local.ps1` | done |
| CF-03 | Packaged native-module probe: load the packaged `better-sqlite3` under the packaged Electron and round-trip a row | `scripts/probe-packaged-native.cjs` | done |
| CF-04 | Wire the probe into CI so it runs **before** publish (tag) and before the artifact upload (dispatch), and into `build-local.ps1` | `.github/workflows/release.yml`, `build-local.ps1` | done |

**Design decision (CF-04) — probe placement gates the publish.** The tag path is
restructured from one `--publish always` step into `package (--publish never)` →
`probe` → `publish (--publish always)`. The publish *mechanism* is unchanged (still
electron-builder's GitHub provider); only the ordering changes, so a probe failure
aborts the job before anything reaches installed clients. Cost: the tag path builds
twice. Rejected alternative: publishing the existing artifacts with `gh release` to
avoid the second build — that would replace the highest-consequence mechanism
(auto-update) in the same slice that adds a gate; it belongs to optional item 5.

**Design decision (CF-01) — frozen in both places.** A published installer must be
assembled from the committed lockfile (the exact defect R1-001 / R3-no-frozen-lockfile
named), and `build-local.ps1` should reproduce CI's dependency bytes. A stale lockfile
now fails loudly instead of silently resolving newer versions.

**Design decision (CF-03) — the probe runs the packaged binary.** `ELECTRON_RUN_AS_NODE=1`
on `release/win-unpacked/TW Time Register.exe`, requiring the unpacked package from
`resources/app.asar.unpacked`. Verified live against the current packaged build *before*
writing CI around it: `{"roundtrip":42,"electron":"44.4.5","node":"24.21.0","abi":"149","napi":"10"}`.
This is the check whose absence R4-2 identified and which the S3 CRITICAL
(`R3-NATIVE-REBUILD-DISABLED`, `npmRebuild: false`) made concrete: it restores a
build-time failure for a missing or ABI-incompatible prebuild, instead of a crash at
database init on an installed machine.

### CF results (2026-09-26)

Commit `cf33b90` — `build(ci): probe the packaged native module before publishing`
(3 files, +91/-9). Route: delegated direct, one bounded writer (2+ non-trivial files).

**Two of the planned details were wrong and were corrected by live evidence, not
assumed:**

1. **The planned gate shape did not gate.** `TW Time Register.exe` is a GUI-subsystem PE
   even under `ELECTRON_RUN_AS_NODE=1`, so PowerShell's call operator `&` returns
   **before** the process exits: `$LASTEXITCODE` is empty on a fresh shell (the manual
   pre-flight probe in this very session printed `EXIT=` empty for that reason) and can
   hold a stale value from an earlier native command. `& ...; if ($LASTEXITCODE -ne 0)`
   would have **silently passed a broken package** — precisely the failure this task
   exists to prevent. Replaced with `Start-Process -Wait -PassThru` and a real
   `.ExitCode`, in both `release.yml` and `build-local.ps1`. Verified by the parent
   independently: success path `ExitCode=0`, deliberate bad-package path `ExitCode=1`.
2. **The `.cjs`-is-not-linted claim was wrong.** In `eslint.config.mjs` the base configs
   (`js.configs.recommended`, `...tseslint.configs.recommended`) carry no `files`, so they
   apply to **every** discovered file, and ESLint 9 lints `.cjs` by default. The scoped
   `files: ['**/*.{js,jsx,ts,tsx}']` block only owns the project rules, not the base ones.
   The probe therefore failed `eslint .` with 13 errors. Fixed in-file with
   `/* eslint-disable @typescript-eslint/no-require-imports */` + `/* global ... */`
   rather than editing the shared config. File stays `.cjs` because the packaged entry
   point and better-sqlite3 are CJS.

| Check | Result |
|---|---|
| `pnpm exec vitest run` | **173 passed / 1 failed** — the single failure is the known pre-existing weekend flake `timeEntriesService.test.ts:339` (today is Saturday; expected `2026-09-26`, got `2026-09-28`). Not a regression. |
| `pnpm run type-check` | clean (exit 0) |
| `pnpm run lint` | clean (exit 0) |
| Probe, direct | exit 0, `{"ok":true,"roundtrip":42,"electron":"44.4.5","node":"24.21.0","abi":"149","napi":"10"}` |
| Probe, failure path | exit 1 (bad package dir → `Cannot find module`) |
| `./build-local.ps1` end to end | exit 0 — `fnm use 22.17.0` → frozen-lockfile install → build → `--dir --publish never` → probe printed the JSON → `Environment restored.` |
| Parent spot check (independent) | success path `ExitCode=0`; deliberate bad-package path `ExitCode=1`; commit content matches the report |

`scripts/` is **not** packaged (`build.files` lists only `dist-electron`, `dist-vite`,
`database/**/*` and specific `node_modules` entries), so the probe is a CI/dev tool and
never ships inside the app.

**Still open after this slice:** the workflow edits change `release.yml`, so the passed
dry run (run `36263921639`) proves the **previous** pipeline only — a fresh
`workflow_dispatch` dry run is owed before any publish. The publish branch itself
(`--publish always`) remains unexecuted and unproven (R4-1), and the tag path now builds
twice (accepted cost of gating the publish; optional item 5 could remove it).

> **Superseded 2026-09-26.** The PG slice that followed replaced the two-build tag path with
> one gated `--publish always` build, so "builds twice" no longer describes the workflow; and
> the owed dispatch dry run was executed (run `36277299134`). The paragraph above is kept as
> the record of the state at the time it was written. See the PG and dry-run sections below.

## Review — the probe gate (carry-forwards 1-3) — approved 2026-09-26

Transaction: lineage `review-d59b5c5ff1fb2501`, base-ref `f7c3a580` (the `195236d` tree),
committed-only, projection workspace, tier **high** (389 lines / 4 files). Four lenses were
selected (risk, resilience, readability, reliability); **all four were admitted**; the
review closed **approved** with no correction opened, and the acknowledgement burned
authority (`gentle-ai.review-acknowledged/v1`, `authority: burned`, consumed revision
`sha256:a2a043e5…`).

Covered candidate: the committed bytes of `cf33b90` + `a5949af`.

**Runtime note (honest).** The `review-readability` slot returned
`opencode_task_output_empty` on attempts 1 and 2 while the other three lenses were admitted
on their first launch. The exact-lineage STATUS reoffered the slot after each empty capture,
so a third launch was permitted under the contract, and it succeeded. This is the same
recurring OpenCode-side empty-output condition recorded earlier in this document; here it
cost two extra launches and did **not** stop the transaction.

### Reviewer results

- **risk** — no findings. Confirmed the `--frozen-lockfile` switch closes a
  dependency-substitution vector, `GH_TOKEN` stays scoped to the publish step (not exposed to
  the probe), and the probe adds no secret or trust boundary: its argv path is always the
  fixed repository-relative argument and the script is not packaged.
- **reliability** — no build-blocking finding; two WARNINGs.
- **resilience** — no build-blocking finding; two WARNINGs and one SUGGESTION.
- **readability** — no build-blocking finding; four SUGGESTIONs.

### Advisory findings (non-blocking, informational)

None opened a correction; none reopens this review. They are later work, never a reason to
re-run the review on this candidate.

| ID | Lens | Location | Severity | Note |
|---|---|---|---|---|
| R3-publish-build-not-probed | reliability | `.github/workflows/release.yml:94` | WARNING | The probe validates the `--publish never` build, but the tag path re-runs `electron-builder --publish always` as a **second build**: the artifact that reaches installed clients is not the artifact the probe inspected, so the gate is only partial. |
| R4-1 | resilience | `.github/workflows/release.yml:78` | WARNING | The same finding, reached independently: the tag path packages twice and the native-module assurance never applies to the published artifact. |
| R3-probe-launch-preflight | reliability | `.github/workflows/release.yml:90` | WARNING | No preflight that `scripts/probe-packaged-native.cjs` exists. With `ELECTRON_RUN_AS_NODE=1` and a missing script argument, the GUI binary starts as a normal app and `Start-Process -Wait` blocks to the Actions timeout instead of failing fast. |
| R4-2 | resilience | `.github/workflows/release.yml:80-88` | WARNING | The new gate itself has **no execution record** — the workflow edit was never dry-run, so a gate defect would first surface during a real tag release. |
| R2-004 | readability | `.github/workflows/release.yml:73-76` | SUGGESTION | The inline comment omits that the gate covers a build that is thrown away on a tag push; that nuance lives only in this document. |
| R2-002 / R4-3 | readability / resilience | `build-local.ps1:39` | SUGGESTION | `ELECTRON_RUN_AS_NODE` is deleted unconditionally, while CF-02 made `npm_config_node_linker` capture/restore — opposite conventions for the same hazard in one script, and "Environment restored." is then untrue for a caller that had it set. |
| R2-001 | readability | `odd/tasks/electron-30-to-44.md:75` | SUGGESTION | The S4 row says the workflow has never been executed and a dry run is owed, while the dry-run section records run `36263921639` as executed — a self-contradiction about whether the pipeline is verified. |
| R2-003 | readability | `scripts/probe-packaged-native.cjs:36` | SUGGESTION | The reported `roundtrip` is the hardcoded literal `42` (repeated at the insert, the assertion and the error text), so the JSON echoes the expectation rather than the observed row. |

### Follow-ups the review motivates (not this slice)

1. **Make the probe cover the published artifact** (R3-publish-build-not-probed / R4-1 /
   R2-004). Three independent lenses reached it: either publish the already-probed output, or
   probe after the publish build and gate on that. This is the S4 review's optional item 5,
   now concretely motivated. Until it lands, the gate certifies a build that a tag push
   discards.
2. **Preflight the probe script's existence** in both call sites so a missing script fails
   immediately instead of hanging to the timeout (R3-probe-launch-preflight).
3. **Restore `ELECTRON_RUN_AS_NODE` like `npm_config_node_linker`** (R2-002 / R4-3).
4. **Re-run the `workflow_dispatch` dry run** against this revision before any publish — the
   gate is unexecuted (R4-2) and the recorded dry run predates the change.
5. Fix the doc self-contradiction at line 75 (R2-001) and the probe sentinel (R2-003).

## S5 — dependency hygiene and doc drift — execution

Task list created 2026-09-26 **before the first source write**, per the ODD tracking rule.
Scope is the slices table row plus the three `→ S5` cleanup notes recorded under S4.

| ID | Task | Files | Status |
|---|---|---|---|
| S5-01 | Remove the dead `electron-is-dev` dependency (S1 migrated the code; only historical comments remain) | `package.json`, `pnpm-lock.yaml` | done |
| S5-02 | Drop the dead `bindings` and `file-uri-to-path` entries from `build.files` and `asarUnpack` — they were better-sqlite3 11 deps, are absent from the graph, and were already absent from the packaged output | `package.json` | done |
| S5-03 | Move the build-time tooling (`vite`, `vite-plugin-electron`, `vite-plugin-electron-renderer`, `@vitejs/plugin-react`) from `dependencies` to `devDependencies`, so electron-builder stops walking them and reporting missing platform-specific `@esbuild/*` / `@rollup/rollup-*` binaries | `package.json`, `pnpm-lock.yaml` | done |
| S5-04 | Clean `pnpm-workspace.yaml`: drop the inert `electron` entry (E42 removed its postinstall), the absent `lzma-native` / `sqlite3` entries, and the self-contradictory `esbuild` entry in `ignoredBuiltDependencies` | `pnpm-workspace.yaml` | done |
| S5-05 | Fix `.github/copilot-instructions.md` drift: `asar: false` → `true`; `better-sqlite3 11.x` → `13.x`; the "Node 24 has no N-API prebuilds" claim; `Electron v30` → `v44` | `.github/copilot-instructions.md` | done |
| S5-06 | Record the platform requirements (macOS 13+, Linux Wayland + GTK 4) and the deliberate deferral of `roundedCorners` | `.github/copilot-instructions.md`, this file | done |

**Why the ordering is safe.** `build.files` already enumerates exactly what is packaged
(`dist-electron`, `dist-vite`, `database/**/*`, and specific `node_modules` entries), so
S5-02/S5-03 change only what electron-builder *walks*, not what the app ships. The output
bundles are produced by Vite before packaging and are unaffected, so no new packaged smoke
test is owed for the content — but the packaging path itself must still be proven, because
S5-03/S5-04 change install/packaging inputs.

**Deliberate deferral — `roundedCorners`.** The E43 change ("frameless windows default to
rounded corners on Linux") was flagged optional in the impact map. This app targets Windows
`nsis`/`x64` only, the user has already accepted the current appearance on the packaged
smoke test under Electron 44, and it is a user-visible cosmetic change. Setting
`roundedCorners: false` would alter window chrome on every platform; it is therefore
**not** applied here and stays available as a one-line change if the appearance is ever
disliked. Recorded, not silently dropped.

### S5 results (2026-09-26)

Commits: `0215900` (`chore(deps): drop dead electron-is-dev and packaging entries; move build
tooling to devDependencies`) and `0110625` (`docs: fix the stack drift in the copilot
instructions and record platform requirements`). Route: delegated direct, one bounded writer.

| Check | Result |
|---|---|
| `pnpm why electron-is-dev` | empty (exit 0) — the last consumer was already gone since S1 |
| `pnpm why bindings` / `file-uri-to-path` | empty — removed from `build.files` **and** `asarUnpack` |
| `pnpm why lzma-native` / `sqlite3` | empty — both absent from the lockfile; removed from **both** lists |
| `pnpm rebuild esbuild` | `postinstall$ node install.js` → `Done` — the surviving allowlist entry still fires |
| `pnpm exec vitest run` | 173 passed / 1 failed — the known pre-existing Saturday flake (`timeEntriesService.test.ts:339`), not a regression |
| `pnpm run type-check` / `lint` | clean, exit 0 each — re-run independently by the parent |
| `./build-local.ps1` end to end | exit 0; probe `{"ok":true,"roundtrip":42,"electron":"44.4.5","node":"24.21.0","abi":"149","napi":"10"}` |
| Packaging warnings | **zero** `@esbuild*` / `@rollup*` / "cannot find platform binary" lines — the S5-03 acceptance signal; electron-builder no longer walks the Vite tooling as production deps |
| Packaged `app.asar.unpacked\node_modules` | contains **only** `better-sqlite3` |
| `pnpm-lock.yaml` diff | 32 lines (12 insertions / 20 deletions), importer membership only — **no version or range changed** |

**Deferred with evidence.** `@types/babel__core` is the same class of drift (types-only, zero
`src/` usage, a transitive dev dependency of `@vitejs/plugin-react`) but was out of this
slice's scope and stays in `dependencies` for later work.

**No new packaged smoke test is owed for content.** `build.files` already enumerated exactly
what ships, so S5-02/S5-03 changed only what electron-builder *walks*: the bundles are produced
by Vite before packaging and are unaffected, the packaged native payload is unchanged, and the
probe re-confirmed it. What was re-proven end to end is the packaging *path*.

## Probe-gate coverage — the published artifact (execution)

Task list created 2026-09-26 **before the first source write**, per the ODD tracking rule.

**Problem.** The probe added by carry-forwards 1-3 certifies the `--publish never` build, but a
tag push re-ran `electron-builder --publish always` as a **second build** and published *that*
uninspected build. Three lenses reached this independently (R3-publish-build-not-probed, R4-1,
R2-004). So the gate certified an artifact that a tag push discards.

**Chosen approach — the probe runs *inside* the build (user decision, 2026-09-26).** The
electron-builder lifecycle was verified against its documentation rather than assumed: Phase 1
pack → Phase 2 sign → Phase 3 artifacts → **`afterPack` / `afterAllArtifactBuild`** → **Phase 4
Publish**, and a `throw` inside a hook **fails the build**. Registering an `afterPack` hook
therefore makes the probe run in the **same build whose bytes are published**, on the packaged
app directory (`context.appOutDir`), and a probe failure aborts the build **before the installer
artifact is even created** — hence before any upload.

Consequences accepted:

- **One build instead of two.** The tag path stops rebuilding; the published artifact is the one
  the probe inspected, by construction rather than by assumption.
- **The publisher and the release flow are untouched** — no `releaseType` change, no `gh release`
  step, no draft to clean up.
- **`dist:win` and `build-local.ps1` become gated too**, so the redundant explicit probe blocks go
  away and the same byte-level check runs on every packaging path.
- **R4-1 improves substantially:** the rehearsal (dispatch) and the publish branch now share the
  build steps *and* their point of failure; only `--publish never` / `--publish always` differs.

Rejected alternatives, recorded: **(a)** draft release + post-upload probe + `gh release edit
--draft=false` — it uploads bytes before validating them and leaves a stranded draft on failure;
**(b)** a single `--publish never` build published with `gh release` — it replaces the
highest-consequence mechanism (auto-update), which was already rejected once for that reason.

| ID | Task | Files | Status |
|---|---|---|---|
| PG-01 | `afterPack` hook that runs the packaged native probe inside the build: win32-only with an explicit skip log elsewhere; preflight the exe, the probe script and the package dir; pass an **absolute** package path; set `ELECTRON_RUN_AS_NODE=1` for the child only; throw on non-zero exit | `scripts/probe-after-pack.cjs` (new) | done |
| PG-02 | Register the hook as `build.afterPack` and keep the `.cjs` ESLint-clean with in-file directives (same precedent as the probe) | `package.json` | done |
| PG-03 | Restructure `release.yml`: tag = one gated `--publish always` build with `GH_TOKEN` scoped to it; dispatch = `--publish never` + artifact upload; drop the now-redundant explicit probe step | `.github/workflows/release.yml` | done |
| PG-04 | Simplify `build-local.ps1`: drop the explicit probe block and its `ELECTRON_RUN_AS_NODE` juggling **if** the hook demonstrably covers `--dir`; otherwise keep it and record why (this closes R2-002 / R4-3 either way) | `build-local.ps1` | done |
| PG-05 | Local proof: the hook fires on `--dir` and on an installer build; a deliberately broken package **fails the build and writes no installer**; `vitest` / `type-check` / `lint`; `build-local.ps1` end to end | — | done |
| PG-06 | Record the slice, its evidence and its residual in the feature doc | this file | done |

**Acceptance criteria.** A probe failure makes `electron-builder` exit non-zero and leaves **no
installer artifact** in `release/`, so nothing can reach installed clients; the published artifact
on a tag push comes from the same build the probe inspected; `build-local.ps1` and `pnpm run
dist:win` are gated without a second copy of the probe logic; `vitest` (known Saturday flake
excepted), `type-check` and `lint` are clean.

**Checks.** `pnpm exec vitest run`, `pnpm run type-check`, `pnpm run lint`, `./build-local.ps1`,
and `pnpm exec electron-builder --win --publish never` with a good and a deliberately broken
package.

**Route.** Delegated direct — one bounded writer (4 non-trivial files).

**Residual risk, stated up front.** The `--publish always` ordering (hook throws ⇒ no upload)
rests on the documented Phase-4 lifecycle and is provable locally only as far as "no installer is
created". The tag branch itself cannot be executed without a real release, so after this lands a
fresh `workflow_dispatch` dry run is owed for the dispatch branch, and the tag branch stays
unexecuted until the first real tag — the same honesty R4-2 demanded of the previous gate.

### PG results (2026-09-26)

Commit `deef356` — `build(ci): gate the published build with an afterPack probe hook`
(4 files, +97/−34). Route: delegated direct, one bounded writer.

**What landed.** A new `scripts/probe-after-pack.cjs`, registered as `build.afterPack`, runs the
existing probe by spawning the packaged binary — never `require`ing it in-process, which would
have tested the dev binary instead of the packaged one. `release.yml` collapsed to two mutually
exclusive steps (tag → one `--publish always` build with step-scoped `GH_TOKEN`; dispatch →
`--publish never` + the artifact upload). `build-local.ps1` lost its explicit probe block and its
`ELECTRON_RUN_AS_NODE` try/finally, because the hook was observed to cover `--dir` too.

**The gate turned out stronger than designed.** The expected result was "the hook fails the build
before the upload". The observed result is that it fails the build before the **installer exists**:
with the packaged prebuild deliberately renamed, `electron-builder --win --publish never` exited
**1** and `release/` held **no `*.exe` and no `latest.yml`**. There is nothing for a publish to
send, on any trigger.

| Check | Result |
|---|---|
| `pnpm run lint` | exit 0 — the new `.cjs` is ESLint-clean through in-file directives; `eslint.config.mjs` untouched |
| `pnpm run type-check` | exit 0 |
| `pnpm exec vitest run` | 173 passed / 1 failed — the known pre-existing Saturday flake (`timeEntriesService.test.ts:339`) |
| `./build-local.ps1` | exit 0; the hook fired for `--dir` (`[afterPack] Probing packaged better-sqlite3 via …\release\win-unpacked\TW Time Register.exe`) and the probe printed `{"ok":true,"roundtrip":42,…}` exactly **once** |
| Gate proof — broken package | `electron-builder` exit **1**, `release\*.exe` count **0**; probe error `Cannot find module '…\app.asar.unpacked\node_modules\better-sqlite3\build\Release\better_sqlite3.node'` |
| Clean rebuild after restore | exit 0, `TW Time Register Setup 1.9.0.exe`, 127 240 681 bytes |
| Parent spot check | `eslint .` re-run independently by the orchestrator: exit 0; the on-disk diff and the hook file match the writer's report |

**Correction to the design record, found live.** `afterPack` does **not** run after the artifacts
phase as the phase diagram implies; in electron-builder 26.15.3 it runs right after packing and
**before signing** (observed log order: `updating asar integrity executable resource` →
`[afterPack]` probe → `signing with signtool.exe`). This makes the gate stricter, not weaker — the
failure lands before the installer is ever created. It also means the probe inspects the unpacked
app **before** its executable is signed. Signing does not touch the native module bytes, which are
the thing the probe exists to check, so the assurance holds; the nuance is recorded, not glossed.

**Findings this closes.** `R3-publish-build-not-probed` and `R4-1` — the published artifact is now
the probed build by construction, and the rehearsal and the publish branch share their build steps
*and* their point of failure. `R3-probe-launch-preflight` — the hook preflights the executable, the
probe script and the package directory before launching anything, so a missing script fails fast
instead of hanging to the Actions timeout. `R2-002` / `R4-3` — the unconditional
`ELECTRON_RUN_AS_NODE` teardown left with the block that needed it. `R2-004` — the workflow comment
now states the gate's relationship to the published artifact. `R2-001` — the S4 row's "never been
executed" contradiction, corrected in this record.

**Still open, honestly.** The tag branch (`--publish always`) remains **unexecuted**. "The hook
aborts before upload" is the documented Phase-4 lifecycle plus a local proof that it aborts before
any artifact exists — not an executed release. A fresh `workflow_dispatch` dry run is owed before
any publish, and it proves the dispatch branch only. `R2-003` (the probe's hardcoded `42` sentinel)
is untouched. `R4-2`'s concern is now concentrated rather than closed: the gate lives in exactly
one place (`build.afterPack`), and that place has still never run in CI. — **Resolved
2026-09-26**: the gate has now run in CI; see the dry-run section below.

## Dry run of the gated pipeline — `workflow_dispatch`, executed 2026-09-26

Run `36277299134` — https://github.com/Draifor/tw-time-register/actions/runs/36277299134
Event `workflow_dispatch`, ref `staging` @ `3f8a0c7`, conclusion **success** (3m5s).
This is the dry run the previous slice owed after `release.yml` changed: the `afterPack` gate
it added had never executed anywhere, not even locally in CI-equivalent conditions.

**Precondition.** `staging` was **11 commits ahead** of `origin/staging` (`e7b407b`), so the
remote still carried the previous workflow — gated, but without the hook. `staging` was
fast-forwarded (`e7b407b..3f8a0c7`, no force) and the remote `release.yml` was fetched back
and verified **before** dispatching to contain `--frozen-lockfile`, `--publish never` on
dispatch, and `--publish always` only under `github.event_name == 'push'`. Dispatching against
the stale remote would have run the old workflow — the same hazard the first dry run documented.

| Step | Result |
|---|---|
| `Install dependencies` | `Lockfile is up to date, resolution step is skipped` — CF-01's `--frozen-lockfile` holds in CI |
| `Build (Vite + Electron)` | success |
| `Package and publish (tag push)` (`if: push`) | **skipped** (step 11 of the job, formally `skipped`) |
| `Package (manual dispatch, no publish)` | success — step env carried no `GH_TOKEN` |
| `Upload installer artifact` | success |
| Artifact | `tw-time-register-windows`, **127 379 573 bytes** (121,5 MB) |
| Releases after the run | unchanged — newest is still `v1.9.0` (2026-09-23) |
| Job | `build-windows` success, 3m5s, every step terminal |

**The decisive record — the gate ran in CI and passed.** This is the first execution of the
`afterPack` probe anywhere except a developer machine. The packaging step log, in order:

```
• updating asar integrity executable resource  executablePath=release\win-unpacked\TW Time Register.exe
[afterPack] Probing packaged better-sqlite3 via D:\a\tw-time-register\tw-time-register\release\win-unpacked\TW Time Register.exe
{"ok":true,"roundtrip":42,"electron":"44.4.5","node":"24.21.0","abi":"149","napi":"10"}
[afterPack] Packaged native module probe passed.
• signing with signtool.exe  path=release\win-unpacked\TW Time Register.exe
• building        target=nsis file=release\TW Time Register Setup 1.9.0.exe archs=x64 oneClick=false perMachine=false
```

That single sequence proves, on the real runner, three things that until now were
documented-but-unexecuted:

1. the hook is discovered and loaded by electron-builder 26.15.3 in CI
   (`loaded configuration file=package.json ("build" field)`);
2. the **ordering** observed locally also holds on `windows-2022` — the probe runs after
   packing and **before signing and before the installer exists**, so a probe failure can
   only abort the build, never ship;
3. the probe loads the **packaged** `better-sqlite3` under the **packaged** Electron
   (`44.4.5` / node `24.21.0` / abi `149` / napi `10`) and round-trips a row inside CI.

`skipped dependencies rebuild reason=npmRebuild is set to false` also confirms in CI that
S3's `npmRebuild: false` behaves as designed and that the prebuild the probe loaded is the
one the packaging path ships.

**What this closes.** R4-2's concern — the gate lives in exactly one place
(`build.afterPack`) and that place had never run in CI — is closed **for the dispatch branch**:
the place has now executed, and what it executed is precisely the packaged-binary check that
R4-2 and the S3 CRITICAL (`R3-NATIVE-REBUILD-DISABLED`) asked for. The dispatch branch of the
current workflow is now proven *with the gate in the path*.

**What it does not close.** The tag branch (`--publish always`) remains **unexecuted** — no
dry run can prove it, because the trigger guard is exactly what keeps it off. What improves is
that the rehearsal and the publish branch now share the build steps *and* their point of
failure (R4-1); only `--publish never` / `--publish always` differs. R2-003 (the probe's
hardcoded `42` sentinel — visible in the log as the echoed `"roundtrip":42`) is untouched.
The app version bump and the publish itself remain separate decisions.
