import { describe, expect, it } from 'vitest';
import { firstNameOf } from './labels';

describe('firstNameOf', () => {
  it('takes the given name from its own field, not from «Фамилия Имя»', () => {
    expect(firstNameOf({ isu: 1, name: 'Волкова Дарья', givenName: ' Дарья ' })).toBe('Дарья');
  });

  it('falls back to the first word of a name without parts, then to the ISU', () => {
    expect(firstNameOf({ isu: 1, name: ' Дарья Волкова ' })).toBe('Дарья');
    expect(firstNameOf({ isu: 1, name: ' ', givenName: null })).toBe('ИСУ 1');
  });
});
