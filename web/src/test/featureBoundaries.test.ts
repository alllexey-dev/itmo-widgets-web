import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });

async function boundaryErrors(filePath: string, source: string) {
  const results = await eslint.lintText(source, { filePath });
  return results.flatMap((result) =>
    result.messages.filter((message) => message.ruleId === 'no-restricted-imports'),
  );
}

describe('feature import boundaries', () => {
  it.each([
    '../moderation/types',
    '../../features/moderation/types',
    '../../test/server',
    '../../App.svelte',
    '../../pages',
    '../../api/../features/moderation/types',
    './nested/../../moderation/types',
  ])('rejects the home feature importing %s', async (specifier) => {
    const errors = await boundaryErrors(
      'src/features/home/BoundaryProbe.ts',
      `export { probe } from '${specifier}';`,
    );

    expect(errors).not.toHaveLength(0);
  });

  it.each([
    './HomePage.svelte',
    '../home/api',
    '../../api/client',
    '../../lib/session.svelte',
    '@alllexey/ui',
    'svelte',
  ])('permits the home feature importing %s', async (specifier) => {
    const errors = await boundaryErrors(
      'src/features/home/BoundaryProbe.ts',
      `export { probe } from '${specifier}';`,
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['lib', 'api'])('%s cannot import features', async (layer) => {
    for (const specifier of ['../features/home/HomePage.svelte', '../features/auth/login']) {
      const errors = await boundaryErrors(
        `src/${layer}/BoundaryProbe.ts`,
        `export { probe } from '${specifier}';`,
      );

      expect(errors).not.toHaveLength(0);
    }
  });

  it.each(['src/pages.ts', 'src/features/home/BoundaryProbe.test.ts', 'src/test/BoundaryProbe.ts'])(
    'permits feature imports in %s',
    async (filePath) => {
      const source =
        filePath === 'src/pages.ts'
          ? "export { probe } from './features/moderation/types';"
          : "export { probe } from '../moderation/types';";
      const errors = await boundaryErrors(filePath, source);

      expect(errors).toHaveLength(0);
    },
  );
});
