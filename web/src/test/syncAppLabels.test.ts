import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';

let root: string;
let app: string;
let output: string;
const git = (...args: string[]) => execFileSync('git', ['-C', app, ...args], { encoding: 'utf8' });
const write = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const commit = () => {
  git('add', 'shared', 'docs');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'Fixture',
  );
  git('update-ref', 'refs/remotes/origin/v2.3/next', 'HEAD');
};
const run = () =>
  spawnSync(process.execPath, [join(root, 'scripts/sync-app-labels.mjs'), '--app', app], {
    encoding: 'utf8',
  });

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'app-labels-test-'));
  app = join(root, 'app');
  mkdirSync(app);
  git('init', '-q');
  write(join(root, 'scripts/sync-app-labels.mjs'), '');
  copyFileSync(
    resolve('../scripts/sync-app-labels.mjs'),
    join(root, 'scripts/sync-app-labels.mjs'),
  );
  output = join(root, 'web/src/test/fixtures/app-labels.json');
  write(
    join(app, 'shared/core/composeResources/values/strings_common.xml'),
    `<resources><string name="z">Текст &amp; \\"цитата\\"</string><string name="a">Первый</string></resources>`,
  );
  write(
    join(app, 'shared/build/values/strings_generated.xml'),
    '<resources><string name="z">Wrong</string></resources>',
  );
  write(join(app, 'docs/design/icons.tsv'), 'id\tsymbol\nlink\tlink\n');
  commit();
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

it('discovers moved resources, skips build copies, decodes XML and writes sorted deterministic values', () => {
  expect(run().status).toBe(0);
  const first = readFileSync(output, 'utf8');
  const fixture = JSON.parse(first);
  expect(fixture.appSha).toBe(git('rev-parse', 'HEAD').trim());
  expect(fixture.strings).toEqual({ a: 'Первый', z: 'Текст & "цитата"' });
  expect(Object.keys(fixture.strings)).toEqual(['a', 'z']);
  expect(fixture.icons).toEqual({ link: 'link' });
  expect(run().status).toBe(0);
  expect(readFileSync(output, 'utf8')).toBe(first);
});

it('refuses conflicting duplicate keys without replacing the fixture', () => {
  expect(run().status).toBe(0);
  const first = readFileSync(output, 'utf8');
  write(
    join(app, 'shared/other/values/strings_other.xml'),
    '<resources><string name="a">Conflict</string></resources>',
  );
  commit();
  const result = run();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Conflicting string a');
  expect(readFileSync(output, 'utf8')).toBe(first);
});

it('refuses uncommitted app resources', () => {
  write(join(app, 'shared/core/composeResources/values/strings_common.xml'), '<resources/>');
  const result = run();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('App source must be clean');
});

it('refuses an icon registry without required columns', () => {
  write(join(app, 'docs/design/icons.tsv'), 'id\tnote\nlink\tlink\n');
  commit();
  const result = run();
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('Icon registry needs id and symbol columns');
});
