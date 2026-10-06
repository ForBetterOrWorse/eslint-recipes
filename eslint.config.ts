import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import vitestPlugin from '@vitest/eslint-plugin';
import { plugin as custom } from './eslint-rules/plugin';

export default defineConfig(
  {
    ignores: ['dist/**', 'coverage/**', '.fixture-out/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { custom },
    rules: {
      'custom/colocated-files': 'error',
      'custom/filename-case': ['error', { ignore: [/^__fixtures__$/u] }],
      'custom/index-reexport-only': 'error',
      'custom/no-default-export': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      curly: ['error', 'all'],
    },
  },
  {
    files: ['*.config.ts'],
    rules: {
      'custom/no-default-export': 'off',
    },
  },
  {
    files: ['**/*.test.ts'],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
      'vitest/consistent-test-it': [
        'error',
        {
          fn: 'it',
          withinDescribe: 'it',
        },
      ],
      'vitest/valid-title': [
        'error',
        {
          mustMatch: {
            it: ['^should\\b'],
            test: ['^should\\b'],
          },
        },
      ],
    },
  }
);
