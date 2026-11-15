import { describe, expect, it } from 'vitest';
import { buildLabel, channelLabel, isPrerelease } from './appBuild';
import { browserLabel, originLabel, osLabel, platformLabel, webClientName } from './clients';
import {
  counted,
  formatDate,
  formatDateTime,
  formatDay,
  formatDuration,
  formatNumber,
  formatRelative,
  plural,
  sentence,
} from './format';

// Intl separates groups with a narrow no-break space and writes "г." after a no-break one.
const plain = (text: string) => text.replace(/[\u202f\u00a0]/g, ' ');
const NOW = new Date('2026-10-05T09:00:00Z');

describe('format', () => {
  it('groups digits the Russian way', () => {
    expect(plain(formatNumber(1234567))).toBe('1 234 567');
  });

  it('writes durations in seconds and minutes', () => {
    expect(formatDuration(2100)).toBe('2,1 с');
    expect(formatDuration(65_000)).toBe('1 мин 5 с');
    expect(formatDuration(120_000)).toBe('2 мин');
  });

  it('writes a day with its weekday, in Moscow', () => {
    expect(formatDay('2026-10-09')).toBe('пт, 9 окт.');
    // 22:30 UTC on Thursday is already Friday in Moscow.
    expect(formatDay(new Date('2026-10-08T22:30:00Z'))).toBe('пт, 9 окт.');
  });

  it('ends a sentence once, even after a short month', () => {
    expect(sentence('Нельзя голосовать без срока')).toBe('Нельзя голосовать без срока.');
    expect(sentence('Нельзя голосовать до 15 окт.')).toBe('Нельзя голосовать до 15 окт.');
  });

  it('leaves the year out of a date of this year', () => {
    expect(formatDate('2026-09-24', NOW)).toBe('24 сент.');
    expect(plain(formatDate('2025-09-24', NOW))).toBe('24 сент. 2025 г.');
  });

  it('shows instants in Moscow time', () => {
    expect(formatDateTime('2026-09-24T11:05:00Z', NOW)).toBe('24 сент., 14:05');
    // A calendar day stays that day in Moscow.
    expect(formatDate('2026-10-01', NOW)).toBe('1 окт.');
  });

  // Abbreviations of units differ between ICU versions ("ч" and "ч."), so the dots are optional.
  it.each([
    ['2026-10-05T08:59:30Z', /^только что$/],
    ['2026-10-05T08:55:00Z', /^5 мин\.? назад$/],
    ['2026-10-05T06:00:00Z', /^3 ч\.? назад$/],
    ['2026-10-04T09:00:00Z', /^вчера$/],
    ['2026-09-20T09:00:00Z', /^20 сент\.$/],
  ])('writes %s relative to now', (value, text) => {
    expect(formatRelative(value, NOW)).toMatch(text);
  });

  it.each([
    [1, 'день'],
    [3, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [21, 'день'],
    [112, 'дней'],
  ])('picks the plural form for %i', (count, form) => {
    expect(plural(count, ['день', 'дня', 'дней'])).toBe(form);
  });

  it('counts with the number formatted', () => {
    expect(plain(counted(1205, ['заявка', 'заявки', 'заявок']))).toBe('1 205 заявок');
  });
});

describe('app builds', () => {
  it('names distribution channels and shows an unknown one as sent', () => {
    expect(channelLabel('play')).toBe('Google Play');
    expect(channelLabel('fdroid')).toBe('fdroid');
  });

  it('labels a build with its number', () => {
    expect(buildLabel('2.3.0-beta.1', 20291)).toBe('2.3.0-beta.1 (20291)');
    expect(buildLabel('2.2', null)).toBe('2.2');
  });

  it('tells a pre-release by its suffix', () => {
    expect(isPrerelease('2.3.0-beta.1')).toBe(true);
    expect(isPrerelease('2.3.0')).toBe(false);
  });
});

describe('clients', () => {
  const CHROME_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const SAFARI_IOS =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';

  it('names this browser the way its connection is shown on the phone', () => {
    expect(webClientName(CHROME_MAC)).toBe('Chrome, macOS');
    expect(webClientName(SAFARI_IOS)).toBe('Safari, iOS');
    expect(webClientName('curl/8.0')).toBe('Браузер');
  });

  it('labels browsers and operating systems of client statistics', () => {
    expect(browserLabel('chrome/131')).toBe('Chrome 131');
    expect(browserLabel('vivaldi/7')).toBe('vivaldi 7');
    expect(osLabel('ANDROID', '36')).toBe('Android API 36');
    expect(platformLabel('WEB', 'yandex/24')).toBe('Яндекс Браузер 24');
    expect(platformLabel('IOS', null)).toBe('Не указано');
  });

  it('says where a build comes from', () => {
    expect(originLabel('github', null)).toBe('GitHub');
    expect(originLabel('custom', 'local')).toBe('Своя сборка · собрано локально');
    expect(originLabel(null, null)).toBe('канал не указан');
  });
});
