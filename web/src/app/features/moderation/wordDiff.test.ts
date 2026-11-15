import { describe, expect, it } from 'vitest';
import { wordDiff } from './wordDiff';

describe('wordDiff', () => {
  it('keeps equal texts as one unchanged part', () => {
    expect(wordDiff('Хорошо объясняет', 'Хорошо объясняет')).toEqual([
      { kind: 'same', text: 'Хорошо объясняет' },
    ]);
  });

  it('marks an inserted and a deleted word', () => {
    expect(wordDiff('Объясняет понятно и быстро', 'Объясняет очень понятно и')).toEqual([
      { kind: 'same', text: 'Объясняет ' },
      { kind: 'added', text: 'очень ' },
      { kind: 'same', text: 'понятно и' },
      { kind: 'removed', text: ' быстро' },
    ]);
  });

  it('lists a replaced word as removed, then added', () => {
    expect(wordDiff('Лекции скучные и длинные', 'Лекции живые и длинные')).toEqual([
      { kind: 'same', text: 'Лекции ' },
      { kind: 'removed', text: 'скучные' },
      { kind: 'added', text: 'живые' },
      { kind: 'same', text: ' и длинные' },
    ]);
  });

  it('adds the whole text when there was nothing before', () => {
    expect(wordDiff('', 'Новый отзыв')).toEqual([{ kind: 'added', text: 'Новый отзыв' }]);
  });

  it('keeps spaces and line breaks', () => {
    const before = 'Первый абзац.\n\nВторой  абзац.';
    const after = 'Первый абзац.\n\nТретий  абзац.';

    const parts = wordDiff(before, after);

    expect(
      parts
        .filter((part) => part.kind !== 'added')
        .map((part) => part.text)
        .join(''),
    ).toBe(before);
    expect(
      parts
        .filter((part) => part.kind !== 'removed')
        .map((part) => part.text)
        .join(''),
    ).toBe(after);
    expect(parts[0]).toEqual({ kind: 'same', text: 'Первый абзац.\n\n' });
  });
});
