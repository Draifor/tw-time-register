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
| **S4** | Packaging/CI for the E42 lazy binary download; verify `release.yml` + `build-local.ps1` still produce a working installer on a clean checkout. | medium |
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

- Every slice is one commit on `staging`; `git revert <sha>` for S1/S2/S4/S5.
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

## S3 — executed (code complete; packaged smoke test pending a human)

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

## S4 — ready to execute (packaging/CI)

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
