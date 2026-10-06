import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { readdirSync } from 'node:fs';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const sources = '**/*.{ts,svelte}';

// A feature imports itself, lib and api; features never import each other (as WB-05 in web/).
function featureBoundaries() {
  const root = new URL('./src/features/', import.meta.url);
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      files: [`src/features/${entry.name}/**/*.{ts,svelte}`],
      ignores: ['**/*.test.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                regex: `^(?:\\.\\./)+(?:features/)?(?!${entry.name}(?:/|$)|lib(?:/|$)|api(?:/|$))[^./][^/]*(?:/|$)`,
                message: 'A feature imports only itself, lib and api.',
              },
              {
                regex: '(?:^|/)[^./][^/]*/\\.\\.(?:/|$)|/\\./|^\\./\\.\\./',
                message: 'Use a canonical import path.',
              },
            ],
          },
        ],
      },
    }));
}

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'node_modules', 'public']),
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  ...svelte.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: tseslint.parser,
        svelteConfig,
      },
    },
  },
  {
    files: [sources],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  // The immutable generator output uses index signatures instead of Record.
  {
    files: ['src/api/schema.ts'],
    rules: { '@typescript-eslint/consistent-indexed-object-style': 'off' },
  },
  ...featureBoundaries(),
  {
    files: ['src/{lib,api}/**/*.{ts,svelte}'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)features(?:/|$)',
              message:
                'lib and api cannot depend on features; compose them in App.svelte and pages.ts.',
            },
          ],
        },
      ],
    },
  },
  ...svelte.configs.prettier,
  prettier,
);
