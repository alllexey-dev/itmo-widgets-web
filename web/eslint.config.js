import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { readdirSync } from 'node:fs';
import tseslint from 'typescript-eslint';

const boundaryMessage =
  'Use the feature itself, api, ui, shared or auth/session and auth/useSession.';
const authSession = 'auth/(?:session|useSession)(?:\\.[cm]?[jt]sx?)?$';

// Per-directory rules preserve nested same-feature parent imports.
function featureBoundaries(directory = new URL('./src/features/', import.meta.url), parts = []) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return [];
    const path = [...parts, entry.name];
    const [feature] = path;
    const depth = path.length - 1;
    const local = [
      '\\./',
      ...Array.from({ length: depth }, (_, i) => `(?:\\.\\./){${i + 1}}(?!\\.\\./)`),
    ];
    const featurePath = `${feature}(?:/|$)|${authSession}`;
    const sharedPath = `(?:api|ui|shared)(?:/|$)|features/(?:${featurePath})`;
    const allowed = [
      ...local,
      `(?:\\.\\./){${depth + 1}}(?:${featurePath})`,
      `(?:\\.\\./){${depth + 2}}(?:${sharedPath})`,
      `(?:\\.\\./){${depth + 3}}src/(?:${sharedPath})`,
      `(?:src|@|~)/(?:${sharedPath})`,
      `features/(?:${featurePath})`,
    ].join('|');
    return [
      {
        files: [`src/features/${path.join('/')}/*.{ts,tsx}`],
        rules: {
          'no-restricted-imports': [
            'error',
            {
              patterns: [
                {
                  regex: `^(?!(?:${allowed}))(?:\\.{1,2}/|(?:src|@|~|features|[@#](?:features|app))/)`,
                  message: boundaryMessage,
                },
                // Non-canonical paths can hide traversal after an otherwise allowed prefix.
                {
                  regex: '(?:^|/)[^./][^/]*/\\.\\.(?:/|$)|/\\./|^\\./\\.\\./',
                  message: 'Use a canonical import path.',
                },
              ],
            },
          ],
        },
      },
      ...featureBoundaries(new URL(`${entry.name}/`, directory), path),
    ];
  });
}

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.strict, tseslint.configs.stylistic],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // The immutable generator output uses index signatures instead of Record.
  {
    files: ['src/api/schema.ts'],
    rules: { '@typescript-eslint/consistent-indexed-object-style': 'off' },
  },
  ...featureBoundaries(),
  {
    files: ['src/{ui,api,shared}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)[@#]?(?:features|app)(?:/|$)',
              message: 'Shared layers cannot depend on features or app.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/test/**', '**/*.test.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off', 'no-restricted-imports': 'off' },
  },
  prettier,
);
