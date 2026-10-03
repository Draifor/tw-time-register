import js from '@eslint/js';
import eslintReact from '@eslint-react/eslint-plugin';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  eslintReact.configs['recommended-typescript'],

  // Global ignores
  {
    ignores: [
      'node_modules/',
      'dist/',
      'dist-electron/',
      'dist-vite/',
      'src/out/',
      // electron-builder output (~364 MB, 12k+ files): scanning it makes `eslint .`
      // effectively hang.
      'release/',
      'coverage/',
      '.opencode/',
      // Vendored skill templates (third-party): formatting them would diverge from
      // upstream and be re-broken on every skill refresh.
      '.agents/'
    ]
  },

  // Main config for all JS/TS files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: {
      prettier
    },
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    rules: {
      // Prettier
      'prettier/prettier': 'error',

      // TypeScript
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn'
    }
  },

  // Prettier must be last to override other configs
  eslintConfigPrettier
);
