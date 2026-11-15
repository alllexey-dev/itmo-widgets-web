import { describe, expect, it } from 'vitest';
import { givenNameOf, listNames } from './labels';

describe('givenNameOf', () => {
  it('takes the given name from its own field, not from «Фамилия Имя»', () => {
    expect(givenNameOf({ name: 'Волкова Дарья', givenName: ' Дарья ' })).toBe('Дарья');
  });

  it('falls back to the first word of a name without parts, then to nothing', () => {
    expect(givenNameOf({ name: ' Дарья Волкова ' })).toBe('Дарья');
    expect(givenNameOf({ name: ' ', givenName: null })).toBe('');
  });
});

describe('listNames', () => {
  it('names one or two people and counts the rest', () => {
    expect(listNames(['Анна'])).toBe('Анна');
    expect(listNames(['Анна', 'Борис'])).toBe('Анна и Борис');
    expect(listNames(['Анна', 'Борис', 'Вера', 'Глеб'])).toBe('Анна, Борис и ещё 2');
  });
});
