# Release publish race — make the tag publish deterministic

## Objective

Remove the failure mode that broke the `v1.12.0` publish: electron-builder's non-atomic
publisher cache lets the concurrently-queued `.exe.blockmap` and `.exe` artifact tasks each
create the GitHub release, so one `POST /releases` wins and the other fails with
`422 already_exists`, aborting the publish and leaving an incomplete release.

## Problem (measured on `v1.12.0`)

- Run [37147551488](https://github.com/Draifor/tw-time-register/actions/runs/37147551488)
  failed in `Package and publish` with `422 already_exists` on `POST /repos/Draifor/tw-time-register/releases`.
- The log shows **two** `creating GitHub release reason=release doesn't exist tag=v1.12.0`
  calls ~25 ms apart. One released; the other threw and aborted the whole publish.
- Result: a single release for `v1.12.0` with **only the `.exe`**, no `latest.yml` and no
  `.blockmap` — dead to the updater. The R4 gate was **skipped** (it runs after a successful
  publish), so only a manual `gh run rerun --failed` recovered it.

### Mechanism (source-verified, `app-builder-lib@26.15.3` / `electron-publish@26.15.3`)

1. The NSIS build emits the `.exe.blockmap` and the `.exe` as two queued artifact events;
   `PublishManager` runs them with `Promise.all`, concurrently.
2. `PublishManager.getOrCreatePublisher` **reads** the cache, `await`s `createPublisher`
   (which awaits a real fs read), then **writes** the cache — a non-atomic read-modify-write.
   Both callers see an empty cache and each build a `GitHubPublisher`.
3. `GitHubPublisher.getOrCreateRelease`
   (`node_modules/electron-publish/out/gitHubPublisher.js:58-113`) lists the repo's releases,
   finds none for the tag, and — because `publish === "always"` — calls `createRelease`
   (`:174-185`). Two concurrent creates: one `201`, one `422 already_exists` (`:166-173`
   only tolerates `already_exists` for *asset* uploads, not for the release create).
4. The `422` rejects `PublishManager`'s task and fails the electron-builder process.

## Approach — pre-create the release, so no publisher ever creates it

`getOrCreateRelease` **reuses** an existing release whose `tag_name` matches (while it is under
its 2-hour republish window, `gitHubPublisher.js:87-98`). So if the release exists **before**
electron-builder starts, **both** publishers find it in the list and only **upload** assets —
the create step never runs, and the race disappears.

The fix adds an idempotent pre-create step that runs on tag pushes, immediately before the
publish step:

- `scripts/ensure-github-release.ps1` — lists the repo releases, and if none matches the tag,
  creates a normal (non-draft, non-prerelease) release via the REST API. A no-op when the
  release already exists.
- `.github/workflows/release.yml` — new step `Pre-create the GitHub release (tag push)` before
  `Package and publish`; and `EP_GH_IGNORE_TIME: 'true'` on the publish step so a manual re-run
  republishes into the tag's own release instead of silently skipping it once it is >2 h old.

Why not the alternatives:

- **Tolerate the 422 in the workflow and re-publish** — recovering after the fact; re-packages,
  and the failure mode stays.
- **Build with `--publish never`, then upload with `gh`/REST** — also removes the race, but
  reimplements asset naming/upload that electron-builder does correctly today; more surface.
- **Upgrade electron-builder** — the non-atomic cache is present in the installed `26.15.3`;
  an upgrade is not guaranteed to fix it and is out of scope.

The R4 post-publish gate stays as an independent, cause-independent detector.

## Scope

- `.github/workflows/release.yml`, `scripts/ensure-github-release.ps1`, this document.

## Out of scope

- `v1.10.0`'s duplicate release (R5 of `release-duplicate-release.md`).
- Changing the R4 gate, the `afterPack` probe, or the `package.json` build config.

## Delivery strategy

`single-pr` / direct work unit. Authored changed lines forecast: ~120. Under the ~400-line
delivery budget.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| P-1 | Open the track and record the mechanism | this document | direct inline | [x] |
| P-2 | Add the idempotent pre-create script | `scripts/ensure-github-release.ps1` | delegated (one writer) | [x] — 106 lines |
| P-3 | Wire the step into the workflow + republish env | `.github/workflows/release.yml` | delegated (one writer) + parent reorder | [x] — +22 lines |
| P-4 | Verify: script parse, idempotent path against the live API, YAML parse | — | delegated + parent spot check | [x] |
| P-5 | Commit the work unit | — | direct inline | [ ] |

## Acceptance criteria

- On a tag push, a release for the tag exists **before** electron-builder runs, so
  `getOrCreateRelease` reuses it and no `create` is issued.
- The step is idempotent: a re-run is a no-op when the release already exists.
- The script fails loudly (non-zero, actionable message) on missing `GH_TOKEN`, a bad repo
  slug, or a non-`201` create response.

## Verification plan

- Syntax: `Parser::ParseFile` reports zero errors.
- Functional (safe, read-only): run the script with `-Tag v1.12.0`, whose release already
  exists → it must print `already exists` and exit 0 without creating anything.
- The create branch cannot be exercised without mutating the repo; the definitive proof is the
  next tag. The mechanism is proven from the publisher source above.

## Verification result

- `Parser::ParseFile` on `scripts/ensure-github-release.ps1` → `parse OK` (zero errors).
- Idempotent path against the live API: `ensure-github-release.ps1 -Tag v1.12.0` →
  `[ensure-github-release] OK: release for 'v1.12.0' already exists (id: 402657266); nothing to create.`
  exit 0, **created/modified nothing** (parent re-ran it independently).
- `gh release view v0.0.0-does-not-exist --repo Draifor/tw-time-register` → exit 1, so the
  create branch is what a missing release triggers.
- `js-yaml.load('.github/workflows/release.yml')` → `yaml OK`.

## Honest limitations

- The **create branch (HTTP 201) is not exercised** until the next tag: exercising it requires
  creating a real release. The mechanism is proven from the publisher source, and the
  already-exists branch is verified against the live repo.
- If packaging fails (e.g. the `afterPack` probe) **after** the pre-create step, an empty
  release remains for the tag. It has no `latest.yml`, so the updater ignores it (404), and a
  workflow re-run republishes into it. Bounded and recoverable, and strictly better than the
  previous failure mode (a release missing assets while CI stayed green).

## Progress

- 2026-10-03 — Track opened from the `v1.12.0` publish failure. Mechanism re-verified against
  `electron-publish@26.15.3` `getOrCreateRelease`/`createRelease`/`doesErrorMeanAlreadyExists`.
- 2026-10-03 — **P-2/P-3/P-4 done:** new `scripts/ensure-github-release.ps1` and the
  `Pre-create the GitHub release (tag push)` step in `release.yml` (+ `EP_GH_IGNORE_TIME` on the
  publish step). Parent reordered the workflow comment so the `afterPack`/"two steps below"
  preamble stays glued to the packaging steps. Verified per *Verification result*.
