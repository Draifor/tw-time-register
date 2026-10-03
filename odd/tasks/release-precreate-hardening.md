# Release pre-create hardening — close the advisory findings from R-7

## Objective

Close the three hardening findings the R-7 review left advisory (non-blocking) in
`release-publish-race.md`, so the pre-create step is robust on its own:

1. **Create is not tolerant of a concurrent create** — the list-then-create is a non-atomic
   check-then-create; a `422 already_exists` on `POST /releases` currently fails the job.
2. **No pagination** — the existence check reads only `per_page=100`.
3. **Draft treated as a match** — the check counts a `draft` release as existing, while
   electron-builder reuses only **non-draft** releases, so exiting 0 on a draft would still race.

## Problem

`scripts/ensure-github-release.ps1` (landed in `0f49a57`) makes the tag's release exist before
electron-builder runs. But the guard itself has three gaps, each reachable and each able to fail
the job or defeat the guard:

- A `422 already_exists` on our own create (a release appeared between our list and our POST,
  the tag fell off page 1, or a draft holds the tag) aborts the step with a non-zero exit.
- The list is capped at the first 100 releases; page-2+ releases are invisible.
- A draft release for the tag passes the existence check, so the script exits 0 while the
  publisher — which reuses only non-draft releases — still attempts a create and races.

## Approach

Harden `scripts/ensure-github-release.ps1` in place:

- **Paginate** the releases listing (`per_page=100&page=N`) until a short page, with a sane
  page cap that aborts loudly instead of looping forever.
- **Match only non-draft** releases for the tag.
- **Draft guard**: if the only release for the tag is a draft, fail with an actionable message
  (publish or delete it) instead of exiting 0 and racing.
- **422 tolerance**: when the create returns `422` whose body reports `already_exists`, re-list
  once and exit 0 only if a non-draft release for the tag is now visible; otherwise fail with a
  clear message.

Add a regression test that exercises these branches **in process**, by shadowing
`Invoke-WebRequest` (a function takes precedence over the cmdlet, and `exit` in an
`&`-invoked script only sets `$LASTEXITCODE`), so no network and no real release are touched.

## Scope

- `scripts/ensure-github-release.ps1` — the hardening.
- `scripts/tests/ensure-github-release.tests.ps1` — new in-process mock test.
- This document.

## Out of scope

- The other advisory findings, explicitly deferred: create-branch `EP_GH_IGNORE_TIME` republish
  trade-off, the empty-public-release-on-later-failure note, and the workflow `push` guard not
  being tag-scoped (`github.event_name == 'push'` also matches branch pushes).
- `.github/workflows/release.yml`, the R4 gate (`verify-release-assets.ps1`), and the
  `afterPack` probe.

## Delivery strategy

`single-pr` / direct work unit. Authored changed-line forecast: ~180 (script ~+60, test ~120).
Under the ~400-line delivery budget.

## Tasks

| ID | Task | Files | Route | Status |
|---|---|---|---|---|
| H-1 | Harden the script: pagination, non-draft match, draft guard, 422 re-list | `scripts/ensure-github-release.ps1` | delegated (one writer) | [x] — 154 lines |
| H-2 | Add the in-process mock regression test | `scripts/tests/ensure-github-release.tests.ps1` | delegated (same writer) | [x] — 9 cases |
| H-3 | Verify: parse, mock test green, live read-only idempotent check | — | delegated + parent spot check | [x] |
| H-4 | Commit the work unit | — | direct inline | [ ] |

## Acceptance criteria

- A `422 already_exists` on create re-lists and exits 0 when a non-draft release for the tag is
  now visible; otherwise exits non-zero with a clear message.
- The listing follows pagination; a matching release on page 2+ is found.
- A draft-only release for the tag does not produce a false success; it exits non-zero with an
  actionable message.
- Existing behavior is preserved: idempotent no-op when a non-draft release exists; loud
  non-zero on missing `GH_TOKEN`, bad repo slug, list non-200, or non-201/non-422 create.
- The mock test exits non-zero on any assertion failure.

## Verification plan

- `Parser::ParseFile` on the script → zero parse errors.
- `pwsh -NoProfile -File scripts/tests/ensure-github-release.tests.ps1` → all cases pass, exit 0.
- Functional (safe, read-only) against the live API: `-Tag v1.12.0` → `already exists`, exit 0,
  creates/modifies nothing.
- The create branch's definitive proof stays the next real tag; the mock covers its logic.

## Verification result

- `Parser::ParseFile` on `scripts/ensure-github-release.ps1` → `parse OK` (zero errors); same on
  the test file.
- `pwsh -NoProfile -File scripts/tests/ensure-github-release.tests.ps1` → all 9 cases PASS,
  `SUMMARY: all cases passed.`, exit 0. Re-run independently by the parent (spot check) → same.
- Live read-only: `ensure-github-release.ps1 -Tag v1.12.0` (authenticated `gh auth token`) →
  `[ensure-github-release] OK: release for 'v1.12.0' already exists (id: 402657266); nothing to create.`
  exit 0, created/modified nothing.

## Honest limitations

- The live `201` create and the live `422 already_exists` re-list branches are proven by the
  in-process mock, not against the real API; exercising them for real requires a tag push. The
  next real tag remains their definitive proof.
- The draft guard and pagination are likewise mock-proven; the live repo has no draft release for
  any tag and fewer than 100 releases, so neither branch is reachable live today.

## Progress

- 2026-10-03 — Track opened to close the R-7 advisory findings. Shadowing mechanism validated
  (mock function visible inside the `&`-invoked script; `exit` sets `$LASTEXITCODE` only).
- 2026-10-03 — **H-1/H-2/H-3 done:** hardened script (154 lines) + 9-case in-process mock test.
  Writer self-verification green; parent re-ran the suite and the live read-only check. See
  *Verification result*.
