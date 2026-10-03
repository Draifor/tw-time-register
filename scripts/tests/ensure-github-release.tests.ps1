#!/usr/bin/env pwsh
#Requires -Version 7.0
<#
.SYNOPSIS
  In-process regression tests for scripts/ensure-github-release.ps1 (no Pester, no network).

.DESCRIPTION
  A global `Invoke-WebRequest` shadows the cmdlet inside the `&`-invoked script, and `exit N` in
  that script only sets `$LASTEXITCODE` and returns, so every branch is exercised in this process.
  Exits non-zero if any case fails.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot '..\ensure-github-release.ps1'
$script:Failures = 0

# --- Fake HTTP layer -------------------------------------------------------------------------
# $global:Mock.Pages is a QUEUE of pages: one entry per list HTTP call, serialized as a JSON
# array. The script fetches page 1, then page 2, ... in order, and the 422 re-list in case 5 is
# simply the next entry. Indexing by ListCalls (rather than the page=N query param) keeps both
# the pagination case (calls 1 and 2) and the re-list case (call 1 empty, call 2 the match)
# deterministic under one rule. An exhausted queue serializes to '[]'.
$global:Mock = @{
  Pages       = @()
  ListStatus  = 200
  Create      = @{ StatusCode = 201; Content = '{"name":"x","id":9}' }
  ListCalls   = 0
  CreateCalls = 0
}

function Invoke-WebRequest {
  param(
    $Uri,
    $Method,
    $Headers,
    $ContentType,
    $Body,
    $MaximumRedirection,
    [switch] $SkipHttpErrorCheck
  )

  if ($Method -eq 'Post') {
    $global:Mock.CreateCalls++
    return [pscustomobject]@{
      StatusCode = $global:Mock.Create.StatusCode
      Content    = $global:Mock.Create.Content
      Headers    = @{}
    }
  }

  # GET (list)
  $global:Mock.ListCalls++
  if ($global:Mock.ListStatus -ne 200) {
    return [pscustomobject]@{
      StatusCode = $global:Mock.ListStatus
      Content    = '{"message":"Forbidden"}'
      Headers    = @{}
    }
  }

  $idx = $global:Mock.ListCalls - 1
  $pages = @($global:Mock.Pages)
  $page = if ($idx -lt $pages.Count) { @($pages[$idx]) } else { @() }
  return [pscustomobject]@{
    StatusCode = 200
    Content    = ConvertTo-Json -InputObject @($page) -Depth 5 -Compress
    Headers    = @{}
  }
}

# --- Helpers ---------------------------------------------------------------------------------
function Make-Release {
  param([string] $Tag, [bool] $Draft, [int] $Id)
  return [pscustomobject]@{
    tag_name = $Tag
    draft    = $Draft
    id       = $Id
    name     = ($Tag -replace '^v', '')
  }
}

function Invoke-Case {
  param(
    [Parameter(Mandatory)] [string] $Name,
    [Parameter(Mandatory)] [hashtable] $Mock,
    [string] $Tag = 'v1.0.0',
    [string] $Repo = 'Draifor/tw-time-register',
    [string] $Token = 'test-token',
    [Parameter(Mandatory)] [int] $ExpectExit,
    [Parameter(Mandatory)] [string] $ExpectMatch,
    [int] $ExpectListCalls = -1,
    [int] $ExpectCreateCalls = -1
  )

  $state = @{
    Pages       = @()
    ListStatus  = 200
    Create      = @{ StatusCode = 201; Content = '{"name":"x","id":9}' }
    ListCalls   = 0
    CreateCalls = 0
  }
  foreach ($key in $Mock.Keys) { $state[$key] = $Mock[$key] }
  $global:Mock = $state

  $env:GH_TOKEN = $Token
  $env:GITHUB_REF_NAME = $Tag
  $env:GITHUB_REPOSITORY = $Repo

  # The script's Fail helper writes via [Console]::Error.WriteLine, which bypasses PowerShell
  # stream redirection (2>&1); capture the raw Console.Error with a StringWriter for this run.
  $errWriter = [System.IO.StringWriter]::new()
  $origError = [Console]::Error
  [Console]::SetError($errWriter)
  try {
    $global:LASTEXITCODE = 0
    $out = & $scriptPath -Tag $Tag -Repository $Repo 2>&1 | Out-String
    $code = $LASTEXITCODE
  } finally {
    [Console]::SetError($origError)
  }
  $out = $out + "`n" + $errWriter.ToString()

  $problems = @()
  if ($code -ne $ExpectExit) { $problems += "exit=$code expected=$ExpectExit" }
  if ($out -notmatch $ExpectMatch) { $problems += "output did not match '$ExpectMatch'" }
  if ($ExpectListCalls -ge 0 -and $global:Mock.ListCalls -ne $ExpectListCalls) {
    $problems += "ListCalls=$($global:Mock.ListCalls) expected=$ExpectListCalls"
  }
  if ($ExpectCreateCalls -ge 0 -and $global:Mock.CreateCalls -ne $ExpectCreateCalls) {
    $problems += "CreateCalls=$($global:Mock.CreateCalls) expected=$ExpectCreateCalls"
  }

  if ($problems.Count -eq 0) {
    Write-Output "PASS: $Name"
  } else {
    $script:Failures++
    Write-Output "FAIL: $Name -- $($problems -join '; ')"
    Write-Output '----- captured output -----'
    Write-Output $out.TrimEnd()
    Write-Output '---------------------------'
  }
}

# --- Cases -----------------------------------------------------------------------------------

# 1. Non-draft match on page 1 -> idempotent no-op, no create attempted.
$match = Make-Release -Tag 'v1.0.0' -Draft $false -Id 11
Invoke-Case -Name '1. non-draft match on page 1 -> already exists' -Mock @{
  Pages = @(, @($match))
} -Tag 'v1.0.0' -ExpectExit 0 -ExpectMatch 'already exists' -ExpectCreateCalls 0

# 2. Pagination: page 1 has 100 non-matching releases; page 2 holds the non-draft match.
$page1 = @(1..100 | ForEach-Object { Make-Release -Tag "v0.0.$_" -Draft $false -Id $_ })
$match2 = Make-Release -Tag 'v2.0.0' -Draft $false -Id 200
Invoke-Case -Name '2. pagination finds match on page 2' -Mock @{
  Pages = @($page1, @($match2))
} -Tag 'v2.0.0' -ExpectExit 0 -ExpectMatch 'already exists' -ExpectListCalls 2 -ExpectCreateCalls 0

# 3. Draft-only release for the tag -> fail with an actionable message.
$draft = Make-Release -Tag 'v1.0.0' -Draft $true -Id 33
Invoke-Case -Name '3. draft only -> fail' -Mock @{
  Pages = @(, @($draft))
} -Tag 'v1.0.0' -ExpectExit 1 -ExpectMatch 'draft release exists'

# 4. No existing release, create returns 201 -> success.
Invoke-Case -Name '4. no existing, create 201' -Mock @{
  Pages  = @(, @())
  Create = @{ StatusCode = 201; Content = '{"name":"x","id":9}' }
} -Tag 'v1.0.0' -ExpectExit 0 -ExpectMatch 'created release' -ExpectCreateCalls 1

# 5. Create races to 422 already_exists; the re-list then shows a non-draft -> adopt, exit 0.
$raced = Make-Release -Tag 'v1.0.0' -Draft $false -Id 55
Invoke-Case -Name '5. 422 already_exists then re-list finds it' -Mock @{
  Pages  = @(@(), @($raced))
  Create = @{ StatusCode = 422; Content = '{"message":"Validation Failed","errors":[{"resource":"Release","code":"already_exists","field":"tag_name"}]}' }
} -Tag 'v1.0.0' -ExpectExit 0 -ExpectMatch 'now exists' -ExpectListCalls 2 -ExpectCreateCalls 1

# 6. Create returns 422 already_exists but the re-list is still empty -> fail.
Invoke-Case -Name '6. 422 already_exists but re-list empty -> fail' -Mock @{
  Pages  = @(@(), @())
  Create = @{ StatusCode = 422; Content = '{"message":"Validation Failed","errors":[{"resource":"Release","code":"already_exists","field":"tag_name"}]}' }
} -Tag 'v1.0.0' -ExpectExit 1 -ExpectMatch 'already_exists,? but no non-draft' -ExpectListCalls 2

# 7. List returns HTTP 403 -> fail loudly.
Invoke-Case -Name '7. list HTTP 403 -> fail' -Mock @{
  ListStatus = 403
} -Tag 'v1.0.0' -ExpectExit 1 -ExpectMatch 'Releases API returned HTTP 403'

# 8. Missing token -> fail before any list.
Invoke-Case -Name '8. missing token -> fail' -Mock @{
  Pages = @()
} -Tag 'v1.0.0' -Token '' -ExpectExit 1 -ExpectMatch 'GH_TOKEN is required' -ExpectListCalls 0

# 9. Invalid repo slug -> fail before any list.
Invoke-Case -Name '9. invalid repo -> fail' -Mock @{
  Pages = @()
} -Tag 'v1.0.0' -Repo 'bad' -ExpectExit 1 -ExpectMatch 'invalid -Repository' -ExpectListCalls 0

# --- Summary ---------------------------------------------------------------------------------
Write-Output ''
if ($script:Failures -gt 0) {
  Write-Output "SUMMARY: $script:Failures case(s) failed."
  exit 1
}
Write-Output 'SUMMARY: all cases passed.'
exit 0
