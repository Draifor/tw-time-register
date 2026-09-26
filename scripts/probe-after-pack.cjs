// electron-builder `afterPack` hook. It runs the packaged-native-module probe
// against the app directory that was just packed, so the check inspects the very
// bytes this build will publish. A thrown error fails the build during the pack
// phase, before any installer artifact is created and therefore before any
// upload happens.
//
// CommonJS on purpose: electron-builder loads JSON-declared hooks as CJS and
// resolves the module's default export. ESLint 9 lints .cjs by default and this
// repo's base configs are unscoped, so the directives below keep them happy
// without editing eslint.config.mjs.
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console, __dirname, module */
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const PROBE_SCRIPT = path.join(__dirname, 'probe-packaged-native.cjs');

function afterPack(context) {
  // The probe assumes the Windows layout (win-unpacked exe name and resources
  // paths). Do not skip silently on other platforms: say so explicitly.
  if (context.electronPlatformName !== 'win32') {
    console.log(
      `[afterPack] Skipping packaged native probe: platform is ${context.electronPlatformName}, not win32.`,
    );
    return;
  }

  const exePath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.exe`,
  );
  const packageDir = path.join(
    context.appOutDir,
    'resources',
    'app.asar.unpacked',
    'node_modules',
    'better-sqlite3',
  );

  // Preflight every path before launching anything. A missing probe script must
  // fail immediately; otherwise we would launch the GUI binary and hang.
  for (const [label, target] of [
    ['packaged executable', exePath],
    ['probe script', PROBE_SCRIPT],
    ['packaged better-sqlite3', packageDir],
  ]) {
    if (!fs.existsSync(target)) {
      throw new Error(`[afterPack] Missing ${label}: ${target}`);
    }
  }

  console.log(`[afterPack] Probing packaged better-sqlite3 via ${exePath}`);

  // spawnSync waits for the real process exit and exposes a real `status`. A
  // shell call is not enough here: PowerShell's `&` returns early for a
  // GUI-subsystem PE and yields an unreliable $LASTEXITCODE, whereas Node waits
  // on the process handle. ELECTRON_RUN_AS_NODE is set on the child env only —
  // process.env is spread, never mutated.
  const result = spawnSync(exePath, [PROBE_SCRIPT, packageDir], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `[afterPack] Packaged native module probe failed (status=${result.status}, signal=${result.signal}).`,
    );
  }

  console.log('[afterPack] Packaged native module probe passed.');
}

// electron-builder resolves a string hook through the module's default export;
// exposing the function both as module.exports and as .default satisfies that.
module.exports = afterPack;
module.exports.default = afterPack;
