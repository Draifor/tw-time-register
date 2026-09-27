// Probes the packaged better-sqlite3 native module using the packaged Electron
// runtime. Intended to run with ELECTRON_RUN_AS_NODE=1, so the app binary behaves
// like plain Node. Exits non-zero when the prebuild is missing or ABI-incompatible.
//
// CommonJS on purpose: the packaged entry point and better-sqlite3 are CJS.
// ESLint 9 lints .cjs by default, so the two directives below keep the unscoped
// base configs happy without editing eslint.config.mjs.
/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, process, console */
const path = require('node:path');

const DEFAULT_PACKAGE_DIR =
  'release/win-unpacked/resources/app.asar.unpacked/node_modules/better-sqlite3';

function main() {
  const packageDir = path.resolve(process.cwd(), process.argv[2] || DEFAULT_PACKAGE_DIR);

  // Loading the package directory runs better-sqlite3's native binding loader.
  const Database = require(packageDir);

  const db = new Database(':memory:');
  try {
    db.exec('CREATE TABLE probe (value INTEGER)');
    db.prepare('INSERT INTO probe (value) VALUES (?)').run(42);
    const row = db.prepare('SELECT value FROM probe').get();
    if (!row || row.value !== 42) {
      throw new Error(`Round-trip mismatch: expected 42, got ${JSON.stringify(row)}`);
    }
  } finally {
    db.close();
  }

  console.log(
    JSON.stringify({
      ok: true,
      roundtrip: 42,
      electron: process.versions.electron,
      node: process.versions.node,
      abi: process.versions.modules,
      napi: process.versions.napi,
    }),
  );
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
}
