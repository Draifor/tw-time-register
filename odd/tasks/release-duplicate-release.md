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

## Root cause — resolved by R3, and it overturns the earlier inference

**The earlier inference was wrong.** Two `publishing` lines do **not** imply two structurally different
configs. For this project the resolved config is identical on every call, so the duplicate comes from a
**non-atomic publisher cache**, not from config divergence.

### The mechanism (source-verified, `app-builder-lib@26.15.3`)

1. The NSIS build emits **two artifact events** from one pack task: the `…exe.blockmap`
   (`…/targets/nsis/differentialUpdateInfoBuilder.js`, `arch: null`) and then the `.exe`
   (`…/targets/nsis/NsisTarget.js:314-321`, `isWriteUpdateInfo: !portable`).
2. `PublishManager`'s `onArtifactCreated` listener does **not await** them — it queues them
   (`PublishManager.js:92-95`). `AsyncTaskManager.awaitTasks` runs queued tasks with `Promise.all`
   (`builder-util/out/asyncTaskManager.js`), so the two tasks run **concurrently**.
3. Both tasks resolve the *same* config (`getPublishConfigs`, `PublishManager.js:337-360`: nsis target → win
   → top-level `config.publish`, i.e. the single object) and both call `scheduleUpload` →
   `getOrCreatePublisher` (`PublishManager.js:112-133`).
4. `getOrCreatePublisher` (`PublishManager.js:166-176`) **reads** the cache at `:169`, then `await`s
   `createPublisher` at `:171`, then **writes** the cache at `:172`. Two concurrent callers with the same key
   both observe an empty cache across that await gap — `createPublisher` awaits a real fs read
   (`resolveReleaseBody` → `readFile`, `PublishManager.js:246,260`) — so both construct a `GitHubPublisher`
   and both log `publishing` (`:173`). Each publisher owns an independent lazy release
   (`electron-publish/out/gitHubPublisher.js`), so `getOrCreateRelease` runs twice → **two releases, assets
   split exactly as observed**: the blockmap on the first, the `.exe` on the second, and `latest.yml`
   (emitted later by `createUpdateInfoTasks`, reusing the same resolved config object) landing on whichever
   publisher the cache kept — the exe one.

### Why the config cannot diverge here

Checked `getResolvedPublishConfig` (`PublishManager.js:413-496`) and `expandPublishConfig` (`:397-408`):

- The single `config.publish` has no `${…}` macros, so `expandPublishConfig` is a no-op and the `arch`
  difference (`null` vs `x64`) cannot change the result.
- The detected `channelFromAppVersion` is applied only for `generic` or through a provider's
  `checkAndResolveOptions`; **`GitHubPublisher` defines no such static** (grep found it only on
  `s3Publisher`/`spacesPublisher`), so for GitHub the channel is dropped and the return is
  `{ owner, repo: project, ...options }` (`:490`) — a deterministic, identically-ordered object.
- The token-based auto-detect branch (`:363-384`) runs only when `publishers == null`, which is not the case
  here.

Both calls therefore produce the **same cache key**, and the race is the only remaining way to reach two
publishers.

### What remains inference (stated honestly)

The source proves the race is *sufficient* and that config divergence is *impossible* for this config; it
does **not** capture the runtime interleaving of the CI run (the `publishing` line only prints
`GitHubPublisher.toString()`, identical for both publishers). Reproducing the race needs `isPublish = true`,
i.e. a real publish, so it was not run. The CI incident is attributed to the race **by elimination**.

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
| R3 | Establish why two publisher configs are resolved from one `build.publish` | `node_modules/app-builder-lib` (read-only) | delegated (one reader) | [x] — premise falsified: configs never diverge; it is a non-atomic publisher-cache race (see *Root cause*) |
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
- 2026-09-28 — **R3 settled by reading the source (the doc's own sanctioned route), and it removed the
  premise.** Two `publishing` lines do **not** mean two different configs: `getResolvedPublishConfig` is
  deterministic for a GitHub config with explicit `owner`/`repo` and no macros. The duplicate is a
  **non-atomic cache in `getOrCreatePublisher`** hit by two concurrently-queued artifact tasks (blockmap +
  `.exe`). No dry publish was run: it cannot exercise the race (`isPublish` is false, so publishers are never
  created) and the configs are provably identical. See *Root cause* for the full chain and the explicit
  inference boundary.

## Resume — the next session starts here

State at hand-off (2026-09-28): `main` = `origin/main` = `staging` = `origin/staging` = `91d10d6`, working
tree clean, `v1.11.0` published **and repaired** (all three updater URLs return 200). **Nothing is
outstanding from the release itself** — what follows is the next work, in order.

1. **R4 — add the post-publish gate** to `.github/workflows/release.yml` (see *Proposed durable fix*): fail
   when more than one release exists for the pushed tag, or when `latest.yml`, the installer or the blockmap
   is not 200 through `https://github.com/Draifor/tw-time-register/releases/download/<tag>/<file>`.
   **Do not trigger a real publish to test it.** The gate can be exercised without publishing anything:
   `v1.11.0` is healthy (all three URLs 200) and `v1.10.0` still has its duplicate pair in place — though
   *which* of `v1.10.0`'s assets resolve has not been tested, so measure it before relying on it as the
   negative case. R3's result makes the *cause-independent* design deliberate: the gate must catch any
   duplicate release, whatever put it there.
2. **R5 (optional)** — repair `v1.10.0`'s duplicate the same way R1 repaired `v1.11.0`.
3. **Then Track B** — `odd/tasks/tailwind-4.md`, on the **local** branch `feat/tailwind-4` (`7dbe5cc`: the
   opening inventory plus the B1 decision *fix the dark variant*). B1 is settled; the next open task is **B2**
   (choose the integration path). That branch has not been pushed — pushing it and opening its PR are still
   the user's decisions.

**Do not repeat:** the repair steps in this document were one-off surgery on a published release. The durable
answer is R4, and the defect is pre-existing — assume it will happen again until the gate exists. **Do not
re-open R3:** the cause is settled by source, and the earlier "two different configs" inference is
falsified; a dry publish cannot settle it further because it cannot exercise the race.

