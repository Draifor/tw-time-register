import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

/**
 * Unit tests for the electron-builder `afterPack` hook. The hook is a CJS module
 * loaded with `createRequire` so the test exercises the exact bytes
 * electron-builder resolves. No child process is ever spawned here: the win32
 * case stops at the preflight, and the non-win32 case returns before any spawn.
 */

interface AfterPackContext {
  electronPlatformName: string;
  appOutDir?: string;
  packager?: { appInfo: { productFilename: string } };
}

interface ProbeHook {
  (context: AfterPackContext): void;
  default: (context: AfterPackContext) => void;
  buildChildEnv: (sourceEnv?: Record<string, string | undefined>) => Record<string, string | undefined>;
}

const nodeRequire = createRequire(import.meta.url);
// Resolve from this file, not from cwd, so the test works regardless of where
// vitest is launched.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.resolve(HERE, '..', '..', '..', '..', 'scripts', 'probe-after-pack.cjs');

const hook = nodeRequire(HOOK_PATH) as ProbeHook;
const { default: afterPack, buildChildEnv } = hook;

const SECRET_NAMES = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'NPM_TOKEN',
  'NODE_AUTH_TOKEN',
  'MY_SECRET',
  'DB_PASSWORD',
  'AWS_SECRET_ACCESS_KEY',
  'VENDOR_API_KEY'
];

const KEPT_NAMES = ['PATH', 'SystemRoot', 'npm_config_node_linker', 'ELECTRON_RUN_AS_NODE'];

const ORIGINAL_CI = process.env.CI;

function restoreCi(): void {
  if (ORIGINAL_CI === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = ORIGINAL_CI;
  }
}

function buildSourceEnv(): Record<string, string> {
  const source: Record<string, string> = {
    PATH: '/usr/bin',
    SystemRoot: 'C:\\Windows',
    npm_config_node_linker: 'hoisted',
    ELECTRON_RUN_AS_NODE: '0'
  };
  for (const name of SECRET_NAMES) {
    source[name] = `secret-value-for-${name}`;
  }
  return source;
}

beforeEach(() => {
  // Keep the suite quiet and let tests assert on what the hook logged.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  restoreCi();
  vi.restoreAllMocks();
});

describe('buildChildEnv', () => {
  it('strips credential variables and keeps unrelated environment names', () => {
    const source = buildSourceEnv();
    const result = buildChildEnv(source);

    expect(Object.keys(result).sort()).toEqual([...KEPT_NAMES].sort());
    for (const name of SECRET_NAMES) {
      expect(name in result).toBe(false);
    }
    expect(console.log).toHaveBeenCalledWith(
      `[afterPack] Removed credential variable(s) from the probe child env: ${[...SECRET_NAMES].sort().join(', ')}`
    );
  });

  it('does not mutate the source env and returns a new object', () => {
    const source = buildSourceEnv();
    const snapshot = { ...source };

    const result = buildChildEnv(source);

    expect(source).toEqual(snapshot);
    expect(result).not.toBe(source);
    for (const name of SECRET_NAMES) {
      expect(name in result).toBe(false);
    }
  });

  it('never exposes the value of a stripped variable', () => {
    const source = buildSourceEnv();
    const result = buildChildEnv(source);
    const serialized = JSON.stringify(result);

    for (const name of SECRET_NAMES) {
      expect(Object.values(result)).not.toContain(source[name]);
      expect(serialized).not.toContain(source[name]);
    }
  });
});

describe('afterPack non-win32 guard', () => {
  it('throws a NOT VERIFIED error when CI is set', () => {
    process.env.CI = 'true';

    expect(() => afterPack({ electronPlatformName: 'darwin' })).toThrow(/NOT VERIFIED/);
  });

  it('warns NOT VERIFIED without throwing when CI is absent', () => {
    delete process.env.CI;

    expect(() => afterPack({ electronPlatformName: 'darwin' })).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('NOT VERIFIED'));
  });
});

describe('afterPack win32 preflight', () => {
  it('throws Missing before spawning when the packaged executable does not exist', () => {
    const appOutDir = path.join(os.tmpdir(), 'tw-time-register-probe-missing-dir');

    expect(() =>
      afterPack({
        electronPlatformName: 'win32',
        appOutDir,
        packager: { appInfo: { productFilename: 'Nope' } }
      })
    ).toThrow(/Missing/);
  });
});
