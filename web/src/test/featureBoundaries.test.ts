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
    '../../../src/features/moderation/types',
    '@/features/moderation/types',
    '@features/moderation/types',
    '#features/moderation/types',
    '@app/routes',
    'src/features/moderation/types',
    '~/features/moderation/types',
    '../auth/login',
    '../../app/routes',
    '../../test/server',
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
    './HomePage',
    '../home/HomePage',
    '../../features/home/HomePage',
    '../../api/admin',
    '../../ui',
    '../../shared/RestrictionsTable',
    '../auth/session',
    '../auth/useSession',
    '../../features/auth/session',
    '@/api/admin',
    'src/shared/RestrictionsTable',
    'react',
  ])('permits the home feature importing %s', async (specifier) => {
    const errors = await boundaryErrors(
      'src/features/home/BoundaryProbe.ts',
      `export { probe } from '${specifier}';`,
    );

    expect(errors).toHaveLength(0);
  });

  it.each(['ui', 'api', 'shared'])('%s cannot import features or the shell', async (layer) => {
    for (const specifier of [
      '../features/home/HomePage',
      '@/features/auth/session',
      '../app/routes',
      'src/app/routes',
      '@features/home/HomePage',
      '#app/routes',
    ]) {
      const errors = await boundaryErrors(
        `src/${layer}/BoundaryProbe.ts`,
        `export { probe } from '${specifier}';`,
      );

      expect(errors).not.toHaveLength(0);
    }
  });

  it.each([
    'src/app/BoundaryProbe.ts',
    'src/features/home/BoundaryProbe.test.ts',
    'src/test/BoundaryProbe.ts',
  ])('permits feature imports in %s', async (filePath) => {
    const errors = await boundaryErrors(filePath, "export { probe } from '../moderation/types';");

    expect(errors).toHaveLength(0);
  });
});
