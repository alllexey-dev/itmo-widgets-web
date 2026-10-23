import { osLabel } from '../../lib/clients';
import { formatDate, formatRelative } from '../../lib/format';
import type { Connection, Install } from './types';

const WEEK = 7 * 24 * 60 * 60_000;

// Backend may add client types; an unknown one shows as a generic device.
const CLIENTS: Partial<Record<string, { label: string; icon: string }>> = {
  agent: { label: 'Агент', icon: 'terminal' },
  mcp: { label: 'MCP', icon: 'smart_toy' },
  web: { label: 'Браузер', icon: 'language' },
};
const DEVICE = { label: 'Устройство', icon: 'devices' };

const PLATFORMS: Record<Install['platform'], string> = { ANDROID: 'Android', IOS: 'iOS' };

export function clientOf(connection: Connection): { label: string; icon: string } {
  return CLIENTS[connection.client] ?? DEVICE;
}

/** "Агент, активность 5 мин. назад", or when it was connected if it has not called yet. */
export function connectionLine(connection: Connection, now = new Date()): string {
  const { label } = clientOf(connection);
  return connection.lastUsedAt
    ? `${label}, активность ${formatRelative(connection.lastUsedAt, now)}`
    : `${label}, подключено ${formatDate(connection.createdAt, now)}`;
}

/** A problem with the client's own ITMO session worth a pill; none for the web, which has no session. */
export function itmoProblem(
  connection: Connection,
  now = new Date(),
): { label: string; tone: 'bad' | 'warn' } | null {
  if (connection.itmoStatus === 'closed') return { label: 'Вход в ИТМО закрыт', tone: 'bad' };
  const ends = connection.itmo?.expiresAt;
  if (ends && Date.parse(ends) - now.getTime() <= WEEK) {
    return { label: `Вход в ИТМО до ${formatDate(ends, now)}`, tone: 'warn' };
  }
  return null;
}

export function installName(install: Install): string {
  return install.deviceName ?? PLATFORMS[install.platform];
}

/** "ITMO.Widgets 2.4.0, Android API 36". */
export function installLine(install: Install): string {
  const system = install.os ? osLabel(install.platform, install.os) : PLATFORMS[install.platform];
  return `ITMO.Widgets ${install.version}, ${system}`;
}
