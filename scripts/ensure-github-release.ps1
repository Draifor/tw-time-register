#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Pre-creates the GitHub release for a pushed tag before electron-builder publishes.

.DESCRIPTION
  electron-builder's GitHub publisher cache is not atomic. The NSIS target emits the
  `.exe.blockmap` and the `.exe` as two queued artifact events, and PublishManager runs them
  with Promise.all: both can read an empty cache, build their own GitHubPublisher and each call
  createRelease. One POST /releases wins and the other returns 422 already_exists, which aborts
  the publish and can leave the release incomplete (observed on v1.12.0).

  GitHubPublisher.getOrCreateRelease lists the repository releases and reuses the one whose
  tag_name matches (while it is under its 2-hour republish window). So if the release exists
  BEFORE electron-builder starts, both publishers find it and only upload assets: no create,
  no race.

  This script makes that precondition true. It is idempotent: it creates nothing when a release
  already exists for the tag, and it never touches any other release.

  Exit code is 0 when a release for the tag exists (created now or already there), non-zero
  with an actionable message otherwise.
#>
[CmdletBinding()]
param(
  # Tag to ensure a release for. On a tag push this is the pushed ref.
  [string] $Tag = $env:GITHUB_REF_NAME,

  # Target repository as owner/repo. CI sets GITHUB_REPOSITORY.
  [string] $Repository = $(if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { 'Draifor/tw-time-register' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'

$prefix = '[ensure-github-release]'

function Fail {
  param([string] $Message)
  [Console]::Error.WriteLine("$prefix FAIL: $Message")
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Tag)) {
  Fail 'no tag. Pass -Tag <tag>, or set GITHUB_REF_NAME in CI.'
}

if ($Repository -notmatch '^[^/]+/[^/]+$') {
  Fail "invalid -Repository '$Repository': expected owner/repo."
}

if ([string]::IsNullOrWhiteSpace($env:GH_TOKEN)) {
  Fail 'GH_TOKEN is required to create a release.'
}

$headers = @{
  'User-Agent'           = 'tw-time-register/ensure-github-release'
  'Accept'               = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
  'Authorization'        = "Bearer $env:GH_TOKEN"
}

# List releases and filter by tag_name - never GET /releases/tags/{tag}, which returns ONE
# arbitrary release for the tag (the blindness that hid the duplicate on v1.11.0).
try {
  $listResponse = Invoke-WebRequest -Uri "https://api.github.com/repos/$Repository/releases?per_page=100" -Headers $headers -Method Get -MaximumRedirection 10 -SkipHttpErrorCheck
} catch {
  Fail "could not query the Releases API: $($_.Exception.Message)"
}
if ([int] $listResponse.StatusCode -ne 200) {
  Fail "Releases API returned HTTP $([int] $listResponse.StatusCode) (expected 200). A 403 usually means the token lacks contents:write or hit the rate limit."
}

$existing = @($listResponse.Content | ConvertFrom-Json | Where-Object { $_.tag_name -eq $Tag })
if ($existing.Count -ge 1) {
  $ids = @($existing | ForEach-Object { $_.id }) -join ', '
  Write-Output "$prefix OK: release for '$Tag' already exists (id: $ids); nothing to create."
  exit 0
}

# Create a normal (non-draft, non-prerelease) release. It must not be a draft: a draft is
# invisible to the updater, and GitHubPublisher only reuses non-draft releases when the
# configured releaseType is 'release'.
$title = $Tag -replace '^v', ''
$payload = @{
  tag_name   = $Tag
  name       = $title
  draft      = $false
  prerelease = $false
  body       = "Release $title"
} | ConvertTo-Json

try {
  $createResponse = Invoke-WebRequest -Uri "https://api.github.com/repos/$Repository/releases" -Headers $headers -Method Post -ContentType 'application/json' -Body $payload -MaximumRedirection 10 -SkipHttpErrorCheck
} catch {
  Fail "could not create the release for '$Tag': $($_.Exception.Message)"
}
if ([int] $createResponse.StatusCode -ne 201) {
  Fail "creating the release for '$Tag' returned HTTP $([int] $createResponse.StatusCode) (expected 201): $($createResponse.Content)"
}

$release = $createResponse.Content | ConvertFrom-Json
Write-Output "$prefix OK: created release '$($release.name)' (id $($release.id)) for tag '$Tag'."
exit 0
