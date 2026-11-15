import { Smartphone, type LucideIcon } from 'lucide-react';
import { CLIENT_KINDS, osLabel, phoneName, type ClientKind } from '../../lib/clients';
import { formatDate, formatRelative } from '../../lib/format';
import type { Connection, Devices, Install } from './types';

export interface DeviceRow {
  id: string;
  icon: LucideIcon;
  title: string;
  text: string;
  /** Works right now: this browser, or an agent that keeps polling. */
  isOnline: boolean;
  /** "3 дн. назад": the last activity of a device that is not online. */
  seen?: string;
}

const KIND: Record<Connection['client'], ClientKind> = { web: 'WEB', agent: 'AGENT', mcp: 'MCP' };

/** What a connected client is for the student first, its technical name second. */
const ROLE: Record<Connection['client'], string> = {
  web: 'Браузер',
  agent: 'Программа на компьютере (агент)',
  mcp: 'ИИ-помощник (MCP)',
};

function connectionRow(connection: Connection, own: boolean, now: Date): DeviceRow {
  const base = {
    id: `connection-${connection.id}`,
    icon: CLIENT_KINDS[KIND[connection.client]].icon,
  };
  if (own) {
    return {
      ...base,
      title: 'Этот браузер',
      text: `${connection.name} · вход ${formatDate(connection.createdAt, now)}`,
      isOnline: true,
    };
  }
  return {
    ...base,
    title: connection.name,
    text: ROLE[connection.client],
    isOnline: connection.live,
    seen: connection.lastUsedAt ? formatRelative(connection.lastUsedAt, now) : undefined,
  };
}

function installRow(install: Install, now: Date): DeviceRow {
  const platform = CLIENT_KINDS[install.platform].label;
  return {
    id: `install-${install.instanceId}`,
    icon: Smartphone,
    title: phoneName(install.platform, install.deviceName),
    text: [
      `ITMO.Widgets ${install.version}`,
      install.os ? osLabel(install.platform, install.os) : platform,
    ].join(' · '),
    isOnline: false,
    seen: formatRelative(install.lastSeenAt, now),
  };
}

/**
 * This browser, the phones with the app, then the other connections. A revoked connection is only
 * waiting for the phone to end its ITMO session and is not a device any more.
 */
export function deviceRows(devices: Devices, ownId: string, now = new Date()): DeviceRow[] {
  const connections = devices.connections.filter((connection) => connection.revokedAt === null);
  const own = connections.filter((connection) => connection.id === ownId);
  const others = connections.filter((connection) => connection.id !== ownId);
  return [
    ...own.map((connection) => connectionRow(connection, true, now)),
    ...devices.installs.map((install) => installRow(install, now)),
    ...others.map((connection) => connectionRow(connection, false, now)),
  ];
}
