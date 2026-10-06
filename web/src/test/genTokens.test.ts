import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
const baseline = JSON.parse(
  readFileSync(resolve('../scripts/test/fixtures/web-tokens-before.json'), 'utf8'),
) as Record<'app' | 'site', Record<'light' | 'dark', Record<string, string>>>;

let root: string;
// The web app's theme comes from @alllexey/ui; only the landing block is generated.
const paths = ['site/style.css'] as const;
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const write = (path: string, text: string) => writeFileSync(join(root, path), text);
const run = (...args: string[]) =>
  spawnSync(process.execPath, [join(root, 'scripts/gen-tokens.mjs'), ...args], {
    encoding: 'utf8',
    cwd: tmpdir(), // The public command resolves its own repository, not cwd.
  });
const props = (css: string): Record<string, string> =>
  Object.fromEntries(
    Array.from(css.matchAll(/--([\w-]+): ([^;]+);/g), (match) => [match[1] ?? '', match[2] ?? '']),
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'web-tokens-'));
  for (const dir of ['scripts', 'tokens', 'site']) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  for (const path of ['scripts/gen-tokens.mjs', 'tokens/tokens.json', ...paths]) {
    copyFileSync(resolve('..', path), join(root, path));
  }
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('generates byte-identical CSS twice and checks without modifying either output', () => {
  expect(run().status).toBe(0);
  const first = paths.map(read);
  expect(run().status).toBe(0);
  expect(paths.map(read)).toEqual(first);
  expect(run('--check').status).toBe(0);
  expect(paths.map(read)).toEqual(first);
  expect(read('site/style.css')).toContain('BEGIN GENERATED TOKENS');
});

it.each(paths)('refuses drift in %s without repairing it in check mode', (path) => {
  write(path, read(path).replace('--primary:', '--primary-drift:'));
  const first = paths.map(read);
  const result = run('--check');
  expect(result.status).toBe(1);
  expect(result.stderr).toContain(`Token drift: ${path}`);
  expect(paths.map(read)).toEqual(first);
});

it('detects changed source values and preserves non-token landing CSS', () => {
  const tokens = JSON.parse(read('tokens/tokens.json'));
  tokens.color.scheme.light.primary = 'rgb(1 2 3)';
  write('tokens/tokens.json', JSON.stringify(tokens));
  expect(run('--check').status).toBe(1);
  const tail = read('site/style.css').split('/* END GENERATED TOKENS */')[1];
  expect(run().status).toBe(0);
  for (const path of paths) expect(read(path)).toContain('--primary: rgb(1 2 3);');
  expect(read('site/style.css').split('/* END GENERATED TOKENS */')[1]).toBe(tail);
});

it.each(['missing', 'duplicate', 'reversed'])(
  'refuses %s landing markers before writing',
  (kind) => {
    const start = '/* BEGIN GENERATED TOKENS */';
    const end = '/* END GENERATED TOKENS */';
    const altered =
      kind === 'missing'
        ? read('site/style.css').replace(start, '')
        : kind === 'duplicate'
          ? start + read('site/style.css')
          : end + '\n' + start;
    write('site/style.css', altered);
    const first = paths.map(read);
    expect(run().status).not.toBe(0);
    expect(paths.map(read)).toEqual(first);
  },
);

it('rejects missing tokens, CSS injection and unsupported schemas without writing', () => {
  const original = read('tokens/tokens.json');
  for (const change of [
    (tokens: ReturnType<typeof JSON.parse>) => delete tokens.color.scheme.dark.primary,
    (tokens: ReturnType<typeof JSON.parse>) => {
      tokens.layout.landingMax = '1080; color: red';
    },
    (tokens: ReturnType<typeof JSON.parse>) => {
      tokens.schemaVersion = 2;
    },
  ]) {
    const tokens = JSON.parse(original);
    change(tokens);
    write('tokens/tokens.json', JSON.stringify(tokens));
    const first = paths.map(read);
    expect(run().status).not.toBe(0);
    expect(paths.map(read)).toEqual(first);
  }
});

it('rejects unknown or repeated CLI options without changing outputs', () => {
  for (const args of [['--write'], ['--check', '--check']]) {
    const first = paths.map(read);
    const result = run(...args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Usage:');
    expect(paths.map(read)).toEqual(first);
  }
});

it('does not write the web app tokens any more', () => {
  expect(run().status).toBe(0);
  expect(existsSync(join(root, 'web/src/ui/tokens.css'))).toBe(false);
});

it('retains all original landing token names and literal fallback values except the border rename', () => {
  const css = read('site/style.css');
  const [expectedLight, expectedDark] = (['light', 'dark'] as const).map((theme) => {
    const expected = { ...baseline.site[theme] } as Record<string, string>;
    expected['outline-variant'] = expected.outline ?? '';
    delete expected.outline;
    return expected;
  });
  const light = props(css.split('@media')[0] ?? '');
  expect(light).toEqual(expectedLight);
  const fallback = css.split('@supports not (color: light-dark(white, black)) {')[1] ?? '';
  const mediaDark = props(fallback.split("  :root[data-theme='dark']")[0] ?? '');
  const manualDark = props(fallback.split("  :root[data-theme='dark']")[1] ?? '');
  expect({ ...light, ...mediaDark }).toEqual(expectedDark);
  expect(manualDark).toEqual(mediaDark);
  expect(css).toContain(":root:not([data-theme='light'])");
  const modern =
    (css.split('@supports (color: light-dark(white, black)) {')[1] ?? '').split(
      '@supports not',
    )[0] ?? '';
  for (const [name, value] of Object.entries(mediaDark)) {
    expect(modern).toContain(`--${name}:`);
    expect(modern).toContain(value);
    expect(modern.match(new RegExp(`--${name}:`, 'g'))).toHaveLength(1);
  }
});
