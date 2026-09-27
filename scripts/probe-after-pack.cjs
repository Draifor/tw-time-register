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

// Bounds how long the probe child may run. A wedged child must fail the build
// fast instead of hanging CI or a developer shell.
const CHILD_TIMEOUT_MS = 120000;

const SECRET_ENV_NAMES = new Set(['GH_TOKEN', 'GITHUB_TOKEN', 'NPM_TOKEN', 'NODE_AUTH_TOKEN']);
const SECRET_ENV_TAIL =
  /(?:^|_)(?:TOKEN|SECRET|SECRETS|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS|APIKEY|API_KEY|ACCESS_KEY|PRIVATE_KEY)$/;

// Builds the environment for the probe child. Credential-looking variables are
// stripped so a packaged build never receives CI publish tokens, and the source
// object is copied rather than mutated.
function buildChildEnv(sourceEnv = process.env) {
  const childEnv = { ...sourceEnv };
  const removed = [];
  for (const name of Object.keys(childEnv)) {
    if (SECRET_ENV_NAMES.has(name) || SECRET_ENV_TAIL.test(name)) {
      delete childEnv[name];
      removed.push(name);
    }
  }
  if (removed.length > 0) {
    console.log(`[afterPack] Removed credential variable(s) from the probe child env: ${removed.sort().join(', ')}`);
  }
  return childEnv;
}

function afterPack(context) {
  // The probe assumes the Windows layout (win-unpacked exe name and resources
  // paths). A non-win32 target cannot be probed, so fail closed on CI and warn
  // loudly elsewhere instead of returning a green result that is
  // indistinguishable from a real probe.
  if (context.electronPlatformName !== 'win32') {
    const marker = `[afterPack] NOT VERIFIED: the packaged native probe is win32-only and this packaging run targets ${context.electronPlatformName}`;
    if (process.env.CI) {
      throw new Error(`${marker}. Refusing to certify an unprobed build.`);
    }
    console.warn(`${marker}. The packaged native module was NOT checked.`);
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
  // buildChildEnv returns a fresh object, so process.env is never mutated. The
  // child is bounded by CHILD_TIMEOUT_MS because a wedged probe must fail the
  // build fast instead of hanging CI or a developer shell.
  const childEnv = buildChildEnv();
  childEnv.ELECTRON_RUN_AS_NODE = '1';
  const result = spawnSync(exePath, [PROBE_SCRIPT, packageDir], {
    env: childEnv,
    stdio: 'inherit',
    timeout: CHILD_TIMEOUT_MS,
    killSignal: 'SIGKILL',
  });

  if (result.error) {
    const detail =
      result.error.code === 'ETIMEDOUT'
        ? `timed out after ${CHILD_TIMEOUT_MS} ms without exiting`
        : `could not be started: ${result.error.message}`;
    throw new Error(`[afterPack] Packaged native module probe ${detail}.`);
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
module.exports.buildChildEnv = buildChildEnv;
