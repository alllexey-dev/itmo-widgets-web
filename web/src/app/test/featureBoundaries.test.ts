import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint({ cwd: process.cwd() });

async function boundaryErrors(filePath: string, source: string) {
  const results = await eslint.lintText(source, { filePath });
  return results.flatMap((result) =>
    result.messages.filter((message) => message.ruleId === 'cabinet/boundaries'),
  );
}

const probe = (specifier: string) => `export { probe } from '${specifier}';`;

describe('feature import boundaries', () => {
  it.each([
    '../moderation/types',
    '../../features/moderation/types',
    '../../test/server',
    '../../App',
    '../../routes',
    '../../api/../features/moderation/types',
    './nested/../../moderation/types',
    '../../../public/site/links',
    '../../../themes/widgets/widgets.js',
  ])('rejects the home feature importing %s', async (specifier) => {
    const errors = await boundaryErrors('src/app/features/home/BoundaryProbe.ts', probe(specifier));

    expect(errors).not.toHaveLength(0);
  });

  it.each([
    './HomePage',
    './home.css',
    '../home/api',
    '../../api/client',
    '../../lib/session',
    '../../../shared/BrandIcon',
    '@astryxdesign/core/Button',
    'react',
  ])('permits the home feature importing %s', async (specifier) => {
    const errors = await boundaryErrors('src/app/features/home/BoundaryProbe.ts', probe(specifier));

    expect(errors).toHaveLength(0);
  });

  it('follows a nested folder of a feature', async () => {
    const file = 'src/app/features/moderation/cases/BoundaryProbe.tsx';

    expect(await boundaryErrors(file, probe('../types'))).toHaveLength(0);
    expect(await boundaryErrors(file, probe('../../../lib/format'))).toHaveLength(0);
    expect(await boundaryErrors(file, probe('../../users/types'))).not.toHaveLength(0);
  });

  it('checks dynamic imports too', async () => {
    const errors = await boundaryErrors(
      'src/app/features/home/BoundaryProbe.ts',
      "export const load = () => import('../stats/StatsPage');",
    );

    expect(errors).not.toHaveLength(0);
  });

  it.each(['lib', 'api'])('%s cannot import features, tests or the app', async (layer) => {
    for (const specifier of [
      '../features/home/HomePage',
      '../features/auth/pairing',
      '../test/server',
      '../routes',
    ]) {
      const errors = await boundaryErrors(`src/app/${layer}/BoundaryProbe.ts`, probe(specifier));

      expect(errors).not.toHaveLength(0);
    }
  });

  it.each(['lib', 'api'])('%s can import lib, api and shared', async (layer) => {
    for (const specifier of ['../api/client', '../lib/format', '../../shared/AppTheme']) {
      const errors = await boundaryErrors(`src/app/${layer}/BoundaryProbe.ts`, probe(specifier));

      expect(errors).toHaveLength(0);
    }
  });

  it.each([
    ['src/app/routes.ts', './features/moderation/types'],
    ['src/app/App.tsx', './features/auth/LoginPage'],
    ['src/app/features/home/BoundaryProbe.test.ts', '../moderation/types'],
    ['src/app/lib/BoundaryProbe.test.tsx', '../routes'],
    ['src/app/test/BoundaryProbe.ts', '../features/moderation/types'],
  ])('permits feature imports in %s', async (filePath, specifier) => {
    const errors = await boundaryErrors(filePath, probe(specifier));

    expect(errors).toHaveLength(0);
  });
});
