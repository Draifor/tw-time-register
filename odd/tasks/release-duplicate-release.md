# Release `v1.11.0` — published, and the duplicate-release defect it exposed

## Objective

Record the `1.11.0` release and the release-pipeline defect it exposed, with the evidence needed to fix it.

## What happened

- `1.10.0` → **`1.11.0`** (`6b5d14c`, `chore(release): 1.11.0`), prepared and tagged **from `main`** as
  requested (the `v1.10.0` tag had been pushed from `staging`).
- Annotated tag `v1.11.0 — React 19 + actualizaciones silenciosas` → Release run `36444425186` →
  **success**, 3m11s.
- The published release was **unusable by the auto-updater**. It was repaired by hand in the same session,
  and the defect that caused it is pre-existing.

## Evidence — measured

| # | Claim | Evidence |
|---|---|---|
| D1 | **electron-builder created two GitHub releases for the same tag.** | `gh api .../releases` → `id=398387383` (assets: only `…exe.blockmap`) and `id=398387386` (assets: `latest.yml` + `…exe`); both `published_at` `2026-09-28T15:35:29Z`, both `author=github-actions[bot]`, both `target=main`. |
| D2 | **The workflow log shows two publishers and two create-release calls ~20 ms apart.** | Run `36444425186`: `• publishing publisher=Github (… version: 1.11.0)` **twice** at `15:35:28.383`, then `• creating GitHub release reason=release doesn't exist tag=v1.11.0 version=1.11.0` at `15:35:28.867` **and** `15:35:28.888`. |
| D3 | **The release was unusable by the updater — not a cosmetic duplicate.** | `electron-updater@6.8.9` builds every download from the tag path: `GitHubProvider.getBaseDownloadPath(tag, fileName)` → `` `${this.basePath}/download/${tag}/${fileName}` `` (`node_modules/electron-updater/out/providers/GitHubProvider.js:183-185`), and `:118` fetches the channel file (`latest.yml`) through that same path. Live checks on those exact URLs for `v1.11.0`: **`latest.yml` → 404**, **`…exe` → 404**, `…exe.blockmap` → 200. GitHub resolves `/releases/download/{tag}/{asset}` to **one** of the duplicates, and for this tag it picked the blockmap-only release. |
| D4 | **Pre-existing, not introduced by this release.** The same duplicate pair exists for `v1.10.0`. | `gh api .../releases` → `tag=v1.10.0`: one release with only `…exe.blockmap`, another with `latest.yml` + `…exe`. `v1.9.0` has a single release with all three. The 1.9.0→1.10.0 update worked only because for that tag the resolution happened to pick the release holding the exe (verified: `releases/download/v1.10.0/TW-Time-Register-Setup-1.10.0.exe` → **200**). **Which assets are reachable is a coin flip determined by which duplicate GitHub resolves.** |
| D5 | The repo's publish config is a **single** object, so the split does not come from an array of providers. | `package.json:142-147` — one `publish` object (`provider: github`, owner, repo, `releaseType: release`). `PublishManager.getPublishConfigs` resolves target → platform → top-level and would return that one object. |

## Repair applied (2026-09-28)

1. Downloaded the blockmap from the tag URL (**133,497 bytes**, equal to the asset size).
2. Deleted the blockmap-only duplicate (`398387383`).
3. Re-uploaded the blockmap to the surviving release (`398387386` — the one `/releases/latest` returns).
4. Verified: **all three** tag URLs return **200** with the expected sizes; `/releases/latest` is `v1.11.0`
   with all three assets; and the published `latest.yml` carries `version: 1.11.0`, `path` equal to the asset
   name and `size` equal to the asset bytes.

**Left alone on purpose:** `v1.10.0`'s duplicate. Same defect, but that release is already consumed in the
field and touching it buys nothing.

## Root cause — what is verified and what is not

- **Verified:** two distinct publisher instances are created inside one build. `PublishManager.
  getOrCreatePublisher` caches publishers by `safeStringifyJson(publishConfig)`
  (`node_modules/app-builder-lib/out/publish/PublishManager.js:166-175`), so two `publishing` log lines mean
  two **structurally different** configs were resolved — and each one created its own release and uploaded a
  subset of the assets.
- **UNVERIFIED:** *why* two configs are resolved from a single `build.publish` object. This session did not
  establish it, and it must not be asserted without evidence (R3).

## Proposed durable fix — a post-publish gate

This repo already trusts a gate that lives *inside* the pipeline (`afterPack` probe, `release.yml:73-86`).
This defect deserves the same treatment: a step **after** publish that

1. asserts **exactly one** release exists for the pushed tag, and
2. fetches `latest.yml`, the installer and the blockmap through the **tag URLs the updater actually uses**
   and fails if any of them is not 200 or its size differs from the release asset.

That is cause-independent, cheap, and it turns "the release silently reaches nobody" into a red workflow.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| R1 | Repair `v1.11.0`: delete the blockmap-only duplicate, re-upload the blockmap, verify all three tag URLs | — | direct inline | [x] — done and verified |
| R2 | Record the release and the defect with its evidence | this document | direct inline | [x] |
| R3 | Establish why two publisher configs are resolved from one `build.publish` | `node_modules/app-builder-lib` (read-only) + a controlled dry publish | delegated (one reader) | [ ] |
| R4 | Add the post-publish gate to the workflow | `.github/workflows/release.yml` | delegated (one writer) | [ ] |
| R5 | Repair `v1.10.0`'s duplicate the same way (optional) | — | direct inline | [ ] |

## Evidence that the release content itself is correct

Pre-publish local proof on `6b5d14c`: `pnpm install --frozen-lockfile` exit 0 with **no lockfile diff**;
`type-check` and `lint` exit 0; `vitest` **196/196** across 21 files; `pnpm run build` exit 0;
`./build-local.ps1` green with the `[afterPack]` probe passing. Version propagation confirmed in the packaged
`app.asar` (`"version": "1.11.0"`) and in the EXE (`FileVersion` `1.11.0`, `ProductVersion` `1.11.0.0`).

## Progress

- 2026-09-28 — **`v1.11.0` published from `main` and repaired.** The release commit, tag, CI run, the defect
  (D1–D5) and the verification are above. The defect was found *because* the release was checked against the
  URLs the updater actually uses rather than against the asset list the API reports — which is exactly what
  R4 proposes to automate.

## Resume — the next session starts here

State at hand-off (2026-09-28): `main` = `origin/main` = `staging` = `origin/staging` = `2f3b9b2`, working
tree clean, `v1.11.0` published **and repaired** (all three updater URLs return 200). **Nothing is
outstanding from the release itself** — what follows is the next work, in order.

1. **R3 — establish why two publisher configs are resolved from a single `build.publish`.** Start from the two
   verified facts in *Root cause*: `PublishManager.getOrCreatePublisher` caches by
   `safeStringifyJson(publishConfig)` (so two `publishing` lines mean two structurally **different** configs),
   while `getPublishConfigs` resolves target → platform → top-level and should yield exactly one. The way to
   settle it is to compare the configs the run actually resolved (`DEBUG=electron-builder` around a dry
   publish, or a read of `getResolvedPublishConfig`/`expandPublishConfig`). **Do not assert a cause before
   that comparison** — the current record deliberately leaves it UNVERIFIED.
2. **R4 — add the post-publish gate** to `.github/workflows/release.yml` (see *Proposed durable fix*): fail
   when more than one release exists for the pushed tag, or when `latest.yml`, the installer or the blockmap
   is not 200 through `https://github.com/Draifor/tw-time-register/releases/download/<tag>/<file>`.
   **Do not trigger a real publish to test it.** The gate can be exercised without publishing anything:
   `v1.11.0` is healthy (all three URLs 200) and `v1.10.0` still has its duplicate pair in place — though
   *which* of `v1.10.0`'s assets resolve has not been tested, so measure it before relying on it as the
   negative case.
3. **Then Track B** — `odd/tasks/tailwind-4.md`, on the **local** branch `feat/tailwind-4` (`7dbe5cc`: the
   opening inventory plus the B1 decision *fix the dark variant*). B1 is settled; the next open task is **B2**
   (choose the integration path). That branch has not been pushed — pushing it and opening its PR are still
   the user's decisions.

**Do not repeat:** the repair steps in this document were one-off surgery on a published release. The durable
answer is R4, and the duplicate-release defect is pre-existing — assume it will happen again until the gate
exists.

