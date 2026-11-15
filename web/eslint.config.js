import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import tseslint from 'typescript-eslint';

const sources = '**/*.{ts,tsx}';
const root = import.meta.dirname;

/** A file or an import target as a path from the package root with forward slashes, or null outside it. */
function inPackage(absolute) {
  const path = relative(root, absolute);
  return path.startsWith('..') || isAbsolute(path) ? null : path.split(sep).join('/');
}

const FEATURE = /^src\/app\/features\/([^/]+)\//;
const LAYER = /^src\/app\/(lib|api)\//;

/**
 * The layers of the cabinet (`docs/architecture.md`, Features layout), checked on resolved paths, so
 * a detour such as `../../api/../features/x` does not get past it:
 * - a feature imports only itself, `src/app/lib`, `src/app/api` and `src/shared`;
 * - `src/app/lib` and `src/app/api` import only each other and `src/shared`.
 * Features meet in `src/app/App.tsx` and `src/app/routes.ts`. Tests are exempt.
 */
const boundaries = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      feature:
        'A feature imports only itself, src/app/lib, src/app/api and src/shared ({{target}}).',
      layer:
        'lib and api import only each other and src/shared; compose features in App.tsx and routes.ts ({{target}}).',
    },
  },
  create(context) {
    const file = inPackage(resolve(context.cwd, context.filename));
    if (!file) return {};
    const feature = FEATURE.exec(file)?.[1];
    const layer = LAYER.test(file);
    if (!feature && !layer) return {};
    const directory = resolve(root, file, '..');

    function check(node) {
      const specifier = node?.value;
      if (typeof specifier !== 'string' || !specifier.startsWith('.')) return;
      const target = inPackage(resolve(directory, specifier.replace(/[?#].*$/, '')));
      const shared = target !== null && /^src\/shared(\/|$)/.test(target);
      const core = target !== null && /^src\/app\/(lib|api)(\/|$)/.test(target);
      const own =
        feature !== undefined &&
        target !== null &&
        (target === `src/app/features/${feature}` ||
          target.startsWith(`src/app/features/${feature}/`));
      if (shared || core || own) return;
      context.report({
        node,
        messageId: feature ? 'feature' : 'layer',
        data: { target: target ?? specifier },
      });
    }

    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};

export default defineConfig(
  globalIgnores([
    'dist',
    'coverage',
    'node_modules',
    'public',
    'themes',
    'src/themes',
    'astryx-themes.js',
  ]),
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  reactHooks.configs.flat['recommended-latest'],
  {
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: [sources],
    rules: { '@typescript-eslint/consistent-type-imports': 'error' },
  },
  // A constant may keep a wide type on purpose (a flag that is `false` today), so the annotation stays.
  { files: [sources], rules: { '@typescript-eslint/no-inferrable-types': 'off' } },
  // The immutable generator output uses index signatures instead of Record.
  {
    files: ['src/app/api/schema.ts'],
    rules: { '@typescript-eslint/consistent-indexed-object-style': 'off' },
  },
  {
    files: ['src/app/{features,lib,api}/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    plugins: { cabinet: { rules: { boundaries } } },
    rules: { 'cabinet/boundaries': 'error' },
  },
  prettier,
);
