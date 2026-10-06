import { describe, expect, it } from 'vitest';
import { ICON_NAMES, iconPath } from './icons';

describe('Material Symbols Rounded icons', () => {
  it('has path data for every typed icon', () => {
    for (const name of ICON_NAMES) expect(iconPath(name), name).toMatch(/^[Mm][\d.-]/);
  });

  it('draws a different filled variant where one is bundled and falls back otherwise', () => {
    expect(iconPath('home', true)).not.toBe(iconPath('home'));
    expect(iconPath('search', true)).toBe(iconPath('search'));
  });
});
