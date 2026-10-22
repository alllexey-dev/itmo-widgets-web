// Names for Backend client statistics (`AdminClients`, `AdminClient`; ITMO.Widgets ADR 0034).
import { browserOf } from '../api/clientHeader';
import { channelLabel } from './appBuild';

export type ClientKind = 'ANDROID' | 'IOS' | 'WEB' | 'AGENT' | 'MCP';

export const CLIENT_KINDS: Record<ClientKind, { label: string; icon: string }> = {
  ANDROID: { label: 'Android', icon: 'smartphone' },
  IOS: { label: 'iOS', icon: 'smartphone' },
  WEB: { label: 'Сайт', icon: 'language' },
  AGENT: { label: 'Агент', icon: 'terminal' },
  MCP: { label: 'MCP', icon: 'smart_toy' },
};

const BROWSERS: Record<string, string> = {
  chrome: 'Chrome',
  safari: 'Safari',
  firefox: 'Firefox',
  edge: 'Edge',
  opera: 'Opera',
  yandex: 'Яндекс Браузер',
  other: 'Другой браузер',
};

const SYSTEMS: [string, RegExp][] = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['ChromeOS', /CrOS/],
  ['Windows', /Windows/],
  ['macOS', /Macintosh|Mac OS X/],
  ['Linux', /Linux/],
];

/** This browser as its connection is named on the phone: `Chrome, macOS`, `Safari, iOS`. */
export function webClientName(userAgent: string): string {
  const family = browserOf(userAgent).split('/')[0] ?? 'other';
  const browser = family === 'other' ? 'Браузер' : (BROWSERS[family] ?? family);
  const system = SYSTEMS.find(([, pattern]) => pattern.test(userAgent))?.[0];
  return system ? `${browser}, ${system}` : browser;
}

/** `chrome/131` -> `Chrome 131`; an unknown family shows as sent. */
export function browserLabel(browser: string): string {
  const [family = '', major] = browser.split('/');
  const name = BROWSERS[family] ?? family;
  return major ? `${name} ${major}` : name;
}

/** The OS line of an app or agent: `Android API 36`, `iOS 18`, `linux-arm64`. */
export function osLabel(kind: ClientKind, os: string): string {
  if (kind === 'ANDROID') return `Android API ${os}`;
  if (kind === 'IOS') return `iOS ${os}`;
  return os;
}

/** A platform row of a kind: browsers for the web, OS versions for the others; null when the client did not say. */
export function platformLabel(kind: ClientKind, name: string | null | undefined): string {
  if (!name) return 'Не указано';
  return kind === 'WEB' ? browserLabel(name) : osLabel(kind, name);
}

/** Where a build comes from: the channel, and the building repository of a custom one. */
export function originLabel(
  channel: string | null | undefined,
  source: string | null | undefined,
): string {
  const parts = [
    channel ? channelLabel(channel) : null,
    source === 'local' ? 'собрано локально' : source,
  ];
  return parts.filter(Boolean).join(' · ') || 'канал не указан';
}
