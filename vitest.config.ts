import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest config — intentionally separate from vite.config.ts so that
 * the Electron/vite-plugin-electron plugins don't interfere with tests.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Default: Node environment for main-process tests.
    // Renderer tests that need the DOM can declare:
    //   // @vitest-environment jsdom
    // at the top of the file.
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/main/services/**', 'src/main/database/models/**', 'src/renderer/lib/**']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer')
    }
  }
});
