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
| **S3** | The version bump: electron 44, better-sqlite3 13, electron-builder 26, electron-updater 6.8.9. Regenerate the lockfile with pnpm, run `install-app-deps`, produce an NSIS installer, smoke-test the **packaged** app. | **high** |
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
- Next: S3 (the version bump) — high risk, needs its own run and a packaged-app
  smoke test. See the checklist above.

## S3 preparation (ready to execute)

Prerequisites verified on this checkout:

- Branch `staging` is clean; S1 (`ed07d9d`) and S2 (`de2af27`) are the last two
  functional commits, so a failed S3 reverts to a known-good pair.
- `release/` is a **build output directory**, not a store: it currently holds only
  `win-unpacked` plus builder metadata, and electron-builder reuses the same output
  path, so the next build overwrites it in place.
- Lockfile is `pnpm-lock.yaml` with pnpm 10 (10.28.2 here) authoritative.
  Regenerate with `pnpm install`, never npm (`.npmrc` is pnpm syntax that npm
  misparses).
- Native rebuild is driven by `electron-builder install-app-deps`
  (`release.yml:77`, `build-local.ps1:29`); `better-sqlite3` is `asarUnpack`ed,
  so the rebuild must target the new Electron ABI, not Node's.
- The Electron-as-Node integration harness needs **no change** for this bump.
  Both integration tests resolve the runner with `require('electron')`, which
  returns the binary of whichever version is installed, and `install-app-deps`
  rebuilds the native module for that same version — harness and native module
  move together. The ABI mismatch that originally motivated the harness cannot
  reappear across the bump.
- Resolved targets against the registry on 2026-09-25 — Electron 44 is still the
  current stable major, so the plan has not drifted: `electron` **44.4.5**,
  `better-sqlite3` **13.0.3**, `electron-builder` **26.15.3**,
  `electron-updater` **6.8.9**.

Execution order for S3 (one commit, revertable):

1. Edit `package.json` with those exact versions.
2. `pnpm install` to regenerate the lockfile, then `electron-builder install-app-deps`.
3. `pnpm exec vitest run`, `pnpm run type-check`, `pnpm run lint`, `pnpm run build`.
4. `pnpm run dist:win` → NSIS installer, then the 7-point smoke test above against
   the **packaged** app (the packaged run is what decides S3, not the dev run).
