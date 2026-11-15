import { describe, expect, it } from 'vitest';
import { formatDayTitle, nextDays } from './labels';

// 23:30 on October 7 in Moscow is still October 7 in UTC.
const NOW = new Date('2026-10-07T20:30:00Z');

describe('nextDays', () => {
  it('counts the days in Moscow, not in UTC', () => {
    expect(nextDays(7, NOW)).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    expect(nextDays(7, new Date('2026-10-07T21:30:00Z')).from).toBe('2026-10-08');
  });
});

describe('formatDayTitle', () => {
  it('names today and tomorrow and capitalises the other days', () => {
    expect(formatDayTitle('2026-10-07', NOW)).toBe('Сегодня, среда, 7 октября');
    expect(formatDayTitle('2026-10-08', NOW)).toBe('Завтра, четверг, 8 октября');
    expect(formatDayTitle('2026-10-09', NOW)).toBe('Пятница, 9 октября');
  });
});
