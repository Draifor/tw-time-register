#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  Post-publish gate: asserts the pushed tag resolved to exactly one GitHub
  release and that the updater's own tag URLs are live and byte-complete.

.DESCRIPTION
  electron-builder can create two GitHub releases for the same tag. Its
  publisher cache is not atomic, so the blockmap and the .exe artifact tasks,
  queued concurrently, can each build their own GitHubPublisher and each create
  a release. The assets then split across the two copies, and GitHub resolves
  /releases/download/<tag>/<asset> to only ONE of them. When it picks the
  blockmap-only copy, latest.yml and the installer 404 on the exact URLs
  electron-updater builds: the release is dead to installed clients while CI
  stays green.

  This gate is deliberately cause-independent. It does not care how a duplicate
  release is produced, only that one must not exist. It is read-only: it reads
  the public Releases API and the public release URLs and never publishes.

  It does NOT use GET /releases/tags/{tag} to count releases: that endpoint
  returns ONE arbitrary release for the tag, which is exactly the blindness
  that hid this defect. Releases are listed and filtered by tag_name instead.

  Exit code is 0 only when exactly one release exists for the tag and every
  expected asset is reachable at HTTP 200 with a Content-Length equal to the
  size the Releases API reports for that asset.
#>
[CmdletBinding()]
param(
  # Tag to verify. On a tag push this is the pushed ref.
  [string] $Tag = $env:GITHUB_REF_NAME,

  # Target repository as owner/repo. CI sets GITHUB_REPOSITORY.
  [string] $Repository = $(if ($env:GITHUB_REPOSITORY) { $env:GITHUB_REPOSITORY } else { 'Draifor/tw-time-register' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$ProgressPreference = 'SilentlyContinue'

$prefix = '[verify-release-assets]'

# Reports a failure to stderr with a specific, actionable message and exits
# non-zero. "Continue" is irrelevant here because the script ends immediately;
# writing straight to stderr avoids the non-terminating-error machinery.
function Fail {
  param([string] $Message)
  [Console]::Error.WriteLine("$prefix FAIL: $Message")
  exit 1
}

if ([string]::IsNullOrWhiteSpace($Tag)) {
  Fail 'no tag to verify. Pass -Tag <tag>, or set GITHUB_REF_NAME in CI.'
}

if ($Repository -notmatch '^[^/]+/[^/]+$') {
  Fail "invalid -Repository '$Repository': expected owner/repo."
}

# The API requires User-Agent; the repo is public, so unauthenticated reads are
# enough. The token is attached only when present and is never printed.
$headers = @{
  'User-Agent'           = 'tw-time-register/verify-release-assets'
  'Accept'               = 'application/vnd.github+json'
  'X-GitHub-Api-Version' = '2022-11-28'
}
if ($env:GH_TOKEN) {
  $headers['Authorization'] = "Bearer $env:GH_TOKEN"
}

# Lists every release on the repository, walking pages until a short page ends
# the sequence (per_page=100). The page cap is a runaway guard, not a limit any
# real repository reaches.
function Get-AllReleases {
  param([string] $Repo)

  $all = [System.Collections.Generic.List[object]]::new()
  $page = 1
  while ($true) {
    $uri = "https://api.github.com/repos/$Repo/releases?per_page=100&page=$page"
    try {
      $response = Invoke-WebRequest -Uri $uri -Headers $headers -Method Get -MaximumRedirection 10 -SkipHttpErrorCheck
    } catch {
      Fail "could not query the Releases API at $uri : $($_.Exception.Message)"
    }
    if ([int] $response.StatusCode -ne 200) {
      Fail "Releases API returned HTTP $([int] $response.StatusCode) for $uri (expected 200). A 403 usually means the API rate limit or a bad token."
    }
    $batch = @($response.Content | ConvertFrom-Json)
    foreach ($release in $batch) {
      $all.Add($release)
    }
    if ($batch.Count -lt 100) {
      break
    }
    $page++
    if ($page -gt 100) {
      Fail 'releases pagination exceeded 100 pages; refusing to continue.'
    }
  }
  return $all
}

$releases = @(Get-AllReleases -Repo $Repository)
$matches = @($releases | Where-Object { $_.tag_name -eq $Tag })

if ($matches.Count -eq 0) {
  Fail "no release found for tag '$Tag' on '$Repository' (expected exactly 1). The publish step did not produce a release for this tag."
}
if ($matches.Count -gt 1) {
  $ids = @($matches | ForEach-Object { $_.id }) -join ', '
  $published = @($matches | ForEach-Object { $_.published_at.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') }) -join ', '
  # The concatenation must be parenthesized: an unparenthesized `"a" + "b"`
  # after a function name binds as separate arguments and only the first string
  # reaches the parameter.
  Fail ("found $($matches.Count) releases for tag '$Tag' (expected exactly 1). Duplicate release ids: $ids (published_at: $published UTC). " +
        "GitHub resolves releases/download/$Tag/<asset> to only one of the duplicates, splitting the assets and 404ing the updater URLs depending on which copy it picks. " +
        'Delete the duplicate release so the surviving one holds every asset.')
}

$release = $matches[0]
$assets = @($release.assets)

$latest = @($assets | Where-Object { $_.name -eq 'latest.yml' })
$blockmaps = @($assets | Where-Object { $_.name -like '*.blockmap' })
$installers = @($assets | Where-Object { $_.name -like '*.exe' -and $_.name -notlike '*.blockmap' })

if ($latest.Count -ne 1) {
  $names = @($assets | ForEach-Object { $_.name }) -join ', '
  Fail "expected exactly one 'latest.yml' asset on the release for tag '$Tag', found $($latest.Count). Release assets: $names"
}
if ($blockmaps.Count -ne 1) {
  $names = @($assets | ForEach-Object { $_.name }) -join ', '
  Fail "expected exactly one '*.blockmap' asset on the release for tag '$Tag', found $($blockmaps.Count). Release assets: $names"
}
if ($installers.Count -ne 1) {
  $names = @($assets | ForEach-Object { $_.name }) -join ', '
  Fail "expected exactly one '.exe' installer asset on the release for tag '$Tag', found $($installers.Count). Release assets: $names"
}

# The updater fetches every asset through the tag path, so verify exactly the
# three names the release carries rather than a hardcoded installer name.
$expected = @(
  [pscustomobject]@{ Name = $latest[0].name; Size = [long] $latest[0].size },
  [pscustomobject]@{ Name = $installers[0].name; Size = [long] $installers[0].size },
  [pscustomobject]@{ Name = $blockmaps[0].name; Size = [long] $blockmaps[0].size }
)

$owner, $repoName = $Repository -split '/', 2
$encodedTag = [uri]::EscapeDataString($Tag)
$baseDownload = "https://github.com/$owner/$repoName/releases/download/$encodedTag"

$failures = [System.Collections.Generic.List[string]]::new()
foreach ($asset in $expected) {
  $url = "$baseDownload/$([uri]::EscapeDataString($asset.Name))"
  $response = $null
  try {
    $response = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 10 -SkipHttpErrorCheck
  } catch {
    $failures.Add("$($asset.Name): tag URL request failed: $($_.Exception.Message) ($url)")
    continue
  }

  $status = [int] $response.StatusCode
  if ($status -ne 200) {
    $failures.Add("$($asset.Name): tag URL returned HTTP $status (expected 200) ($url)")
    continue
  }

  # A tag URL must report the byte count the API reports for the asset; a
  # mismatch means the URL resolves to a different copy than the release.
  $rawLength = $response.Headers['Content-Length']
  if ($rawLength -is [array]) {
    $rawLength = $rawLength[0]
  }
  if ([string]::IsNullOrWhiteSpace([string] $rawLength)) {
    $failures.Add("$($asset.Name): tag URL returned 200 without a Content-Length header, so its size cannot be compared with the release asset ($($asset.Size) bytes) ($url)")
    continue
  }
  $actualSize = [long] $rawLength
  if ($actualSize -ne $asset.Size) {
    $failures.Add("$($asset.Name): size mismatch - release asset reports $($asset.Size) bytes but the tag URL returned Content-Length $actualSize ($url)")
    continue
  }

  Write-Output "$prefix OK: $($asset.Name) HTTP 200, $actualSize bytes"
}

if ($failures.Count -gt 0) {
  foreach ($failure in $failures) {
    [Console]::Error.WriteLine("$prefix FAIL: $failure")
  }
  exit 1
}

Write-Output "$prefix PASS: tag '$Tag' has exactly one release on '$Repository' and all three updater URLs return 200 with sizes matching the release assets."
exit 0
