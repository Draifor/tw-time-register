# build-local.ps1
# Builds the app locally for testing without admin rights.
# Uses --dir (unpacked) so no installer is needed.
# Temporarily sets node-linker=hoisted for electron-builder compatibility.

$ErrorActionPreference = "Stop"

# Ensure Node 22 is active (better-sqlite3 has prebuilt binaries for Node 22)
Write-Host "==> Switching to Node 22..." -ForegroundColor Cyan
fnm use 22.17.0

Write-Host "==> Switching to hoisted node_modules for packaging..." -ForegroundColor Cyan
$npmrcBackup = Get-Content .npmrc -Raw
# Keep onlyBuiltDependencies so pnpm downloads prebuilt binaries instead of compiling
Set-Content .npmrc @"
node-linker=hoisted

onlyBuiltDependencies:
  - better-sqlite3
  - electron
  - esbuild
"@

try {
    Write-Host "==> Installing dependencies (hoisted, Node 22)..." -ForegroundColor Cyan
    pnpm install --no-frozen-lockfile

    Write-Host "==> Rebuilding native modules for Electron..." -ForegroundColor Cyan
    pnpm exec electron-builder install-app-deps

    Write-Host "==> Building Vite + Electron..." -ForegroundColor Cyan
    pnpm build

    Write-Host "==> Packaging (unpacked, no installer)..." -ForegroundColor Cyan
    pnpm exec electron-builder --win --dir

    Write-Host ""
    Write-Host "==> Done! Run the app at:" -ForegroundColor Green
    Write-Host "    release\win-unpacked\TW Time Register.exe" -ForegroundColor Yellow
} finally {
    Write-Host "==> Restoring .npmrc..." -ForegroundColor Cyan
    Set-Content .npmrc $npmrcBackup
    Write-Host "==> .npmrc restored." -ForegroundColor Green
}
