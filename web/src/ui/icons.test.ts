import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ICON_NAMES } from './icons';

const fontFile = (name: string) => readFileSync(resolve(process.cwd(), `public/fonts/${name}`));

describe('self-hosted icon subset', () => {
  it('covers every typed icon with a unique sorted name', () => {
    const names = fontFile('names.txt').toString().trim().split('\n');
    expect(names).toEqual(ICON_NAMES);
    expect(names).toEqual([...new Set(names)].sort());
  });

  it('matches the font whose exact ligatures and FILL axis were verified during generation', () => {
    const manifest = JSON.parse(fontFile('manifest.json').toString());
    expect(manifest.names).toEqual(ICON_NAMES);
    expect(manifest.axes).toEqual({ FILL: [0, 0, 1], opsz: 24, wght: 400, GRAD: 0 });
    expect(
      createHash('sha256').update(fontFile('material-symbols-rounded.woff2')).digest('hex'),
    ).toBe(manifest.sha256);
  });
});
