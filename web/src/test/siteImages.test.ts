import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'site-images-'));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'site/img'), { recursive: true });
  mkdirSync(join(root, 'site/link'));
  copyFileSync(resolve('../scripts/check-site.sh'), join(root, 'scripts/check-site.sh'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function check() {
  return spawnSync('bash', [join(root, 'scripts/check-site.sh'), '--unreferenced'], {
    encoding: 'utf8',
  });
}

describe('static image reference check', () => {
  it('accepts root, relative, CSS, JavaScript and srcset references', () => {
    for (const name of ['root', 'relative', 'css', 'js', 'srcset']) {
      writeFileSync(join(root, `site/img/${name}.webp`), '');
    }
    writeFileSync(
      join(root, 'site/index.html'),
      '<img src="/img/root.webp?x=1"><source srcset="/img/srcset.webp 2x">',
    );
    writeFileSync(join(root, 'site/link/page.html'), '<img src="../img/relative.webp">');
    writeFileSync(join(root, 'site/style.css'), 'a { background: url("img/css.webp#x"); }');
    writeFileSync(join(root, 'site/theme.js'), 'const image = "/img/js.webp";');
    expect(check().status).toBe(0);
  });

  it('lists unreferenced nested images and ignores substring and unrelated files', () => {
    mkdirSync(join(root, 'site/img/dark'));
    writeFileSync(join(root, 'site/img/dark/missing.webp'), '');
    writeFileSync(join(root, 'site/index.html'), '<img src="/img/dark/missing.webp.backup">');
    writeFileSync(join(root, 'site/notes.txt'), '/img/dark/missing.webp');
    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe('site/img/dark/missing.webp');
  });

  it('passes the actual landing without deleting images', () => {
    expect(
      execFileSync('bash', [resolve('../scripts/check-site.sh'), '--unreferenced'], {
        encoding: 'utf8',
      }),
    ).toContain('All site images are referenced.');
  });
});
