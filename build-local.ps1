# build-local.ps1
# Builds the app locally for testing without admin rights.
# Uses --dir (unpacked) so no installer is needed.
# electron-builder needs a flat (hoisted) node_modules; pnpm reads node-linker from
# the environment, so .npmrc is never rewritten.

$ErrorActionPreference = "Stop"

# Ensure Node 22 is active (the app and its tooling target Node 22)
Write-Host "==> Switching to Node 22..." -ForegroundColor Cyan
fnm use 22.17.0

Write-Host "==> Packaging with hoisted node_modules..." -ForegroundColor Cyan
$previousNodeLinker = $env:npm_config_node_linker
$env:npm_config_node_linker = "hoisted"

try {
    Write-Host "==> Installing dependencies (hoisted, Node 22)..." -ForegroundColor Cyan
    pnpm install --frozen-lockfile

    Write-Host "==> Building Vite + Electron..." -ForegroundColor Cyan
    pnpm build

    Write-Host "==> Packaging (unpacked, no installer)..." -ForegroundColor Cyan
    pnpm exec electron-builder --win --dir --publish never

    Write-Host "==> Probing packaged native module..." -ForegroundColor Cyan
    $env:ELECTRON_RUN_AS_NODE = "1"
    try {
        # The Electron binary is GUI-subsystem, so a bare `&` call returns before
        # the process exits and $LASTEXITCODE is unreliable. Start-Process -Wait
        # blocks and exposes a real ExitCode, which is what gates the build.
        $probe = Start-Process -FilePath "release\win-unpacked\TW Time Register.exe" `
            -ArgumentList "scripts\probe-packaged-native.cjs" -NoNewWindow -Wait -PassThru
        if ($probe.ExitCode -ne 0) {
            throw "Packaged native module probe failed with exit code $($probe.ExitCode)"
        }
    } finally {
        Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
    }

    Write-Host ""
    Write-Host "==> Done! Run the app at:" -ForegroundColor Green
    Write-Host "    release\win-unpacked\TW Time Register.exe" -ForegroundColor Yellow
} finally {
    if ($null -ne $previousNodeLinker) {
        $env:npm_config_node_linker = $previousNodeLinker
    } else {
        Remove-Item Env:\npm_config_node_linker -ErrorAction SilentlyContinue
    }
    Write-Host "==> Environment restored." -ForegroundColor Green
}
