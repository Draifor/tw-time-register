import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { UserConfig, ConfigEnv } from 'vite';
import { rmSync } from 'node:fs';
import { join } from 'path';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const root = join(__dirname);
const srcRoot = join(__dirname, 'src/renderer');
rmSync('dist-electron', { recursive: true, force: true });

const buildElectron = (isDev: boolean) => ({
  sourcemap: isDev,
  minify: !isDev,
  outDir: join(root, 'dist-electron'),
  rollupOptions: {
    // Only externalize the Electron runtime and native modules (.node binaries).
    // Everything else (axios, electron-updater, etc.) gets bundled into index.js
    // so node_modules doesn't need to be present in the installed app.
    external: ['electron', 'better-sqlite3']
  }
});

function plugins(isDev: boolean) {
  return [
    tailwindcss(),
    react(),
    electron([
      {
        // Main-Process entry file of the Electron App.
        entry: join(root, 'src/main/index.ts'),
        onstart(options) {
          // v1 spawns Electron with `cwd = Vite's root`, which this project sets to
          // `src/renderer`, so `electron .` would not find the app. Pin the child to
          // the repo root — where v0.29 spawned from, because it used `process.cwd()`.
          // `triggerStartup` spreads caller options after its own `cwd`, so this wins.
          options.startup(undefined, { cwd: root });
        },
        vite: {
          build: buildElectron(isDev)
        }
      },
      {
        entry: join(root, 'src/main/preload.ts'),
        onstart(options) {
          // Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
          // instead of restarting the entire Electron App.
          options.reload();
        },
        vite: {
          build: buildElectron(isDev)
        }
      }
    ]),

    renderer()
  ];
}

export default ({ command }: ConfigEnv): UserConfig => {
  // DEV
  if (command === 'serve') {
    return {
      root: srcRoot,
      base: '/',
      plugins: plugins(true),
      resolve: {
        alias: {
          '@': srcRoot
        }
      },
      build: {
        outDir: join(root, '/dist-vite'),
        emptyOutDir: true,
        rollupOptions: {}
      },
      server: {
        port: process.env.PORT === undefined ? 3000 : +process.env.PORT
      },
      optimizeDeps: {
        exclude: ['path']
      }
    };
  }
  // PROD
  return {
    root: srcRoot,
    base: './',
    plugins: plugins(false),
    resolve: {
      alias: {
        '@': srcRoot
      }
    },
    build: {
      outDir: join(root, '/dist-vite'),
      emptyOutDir: true,
      rollupOptions: {}
    },
    server: {
      port: process.env.PORT === undefined ? 3000 : +process.env.PORT
    },
    optimizeDeps: {
      exclude: ['path']
    }
  };
};
