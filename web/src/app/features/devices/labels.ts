import type { TokenColor } from '@astryxdesign/core/Token';
import { Bot, Globe, MonitorSmartphone, Terminal, type LucideIcon } from 'lucide-react';
import { osLabel, phoneName } from '../../lib/clients';
import { formatDate, formatRelative } from '../../lib/format';
import type { Connection, Install, ScopeGrant, ScopeId } from './types';

const WEEK = 7 * 24 * 60 * 60_000;

/** Where the app keeps what the web cannot do: its own devices screen. */
const IN_APP = 'Профиль → Устройства';

/**
 * What turning a phone's notifications off also stops: Backend signals a sport sign-up only to a
 * phone a push can reach. The profile page says the same.
 */
export const STOPS_SPORT = 'Вместе с ними остановится запись на спорт через этот телефон.';

/** What the web can do with a phone and what it cannot, above the list of phones. */
export const PHONES_HINT = `Отсюда можно только отключить уведомления на телефоне. ${STOPS_SPORT} Вход в ИТМО на нём завершается в приложении на другом телефоне: ${IN_APP}`;

interface ClientType {
  label: string;
  icon: LucideIcon;
}

// What the client is for the student first, its technical name second. Backend may add client
// types; an unknown one shows as a generic device.
const CLIENTS: Partial<Record<string, ClientType>> = {
  agent: { label: 'Программа на компьютере (агент)', icon: Terminal },
  mcp: { label: 'ИИ-помощник (MCP)', icon: Bot },
  web: { label: 'Браузер', icon: Globe },
};
const DEVICE: ClientType = { label: 'Устройство', icon: MonitorSmartphone };

const PLATFORMS: Record<Install['platform'], string> = { ANDROID: 'Android', IOS: 'iOS' };

export function clientOf(connection: Connection): ClientType {
  return CLIENTS[connection.client] ?? DEVICE;
}

/** The client type with the last activity, or with the day it was connected if it has not called yet. */
export function connectionLine(connection: Connection, now = new Date()): string {
  const { label } = clientOf(connection);
  return connection.lastUsedAt
    ? `${label} · активность ${formatRelative(connection.lastUsedAt, now)}`
    : `${label} · подключено ${formatDate(connection.createdAt, now)}`;
}

export interface ItmoProblem {
  /** The state, on a token. */
  label: string;
  color: TokenColor;
  /** What it means for the client and where to fix it. */
  text: string;
}

/**
 * A problem with the client's own ITMO session; none for the web, which has no session. The
 * connection to ITMO.Widgets itself keeps working; only the phone app can renew the session.
 */
export function itmoProblem(connection: Connection, now = new Date()): ItmoProblem | null {
  const { name } = connection;
  const where = `${IN_APP} → ${name}`;
  if (connection.itmoStatus === 'closed') {
    return {
      label: 'Вход в ИТМО закрыт',
      color: 'red',
      text: `${name} не может обращаться к My ITMO. Чтобы вернуть доступ, войдите заново в приложении: ${where}.`,
    };
  }
  const ends = connection.itmo?.expiresAt;
  if (ends && Date.parse(ends) - now.getTime() <= WEEK) {
    return {
      label: `Вход в ИТМО до ${formatDate(ends, now)}`,
      color: 'orange',
      text: `Потом ${name} не сможет обращаться к My ITMO. Обновите вход в приложении: ${where}.`,
    };
  }
  return null;
}

/** The scopes that stay when [scope] is taken away: the body of a narrowing request. */
export function scopesWithout(connection: Connection, scope: ScopeId): ScopeId[] {
  return connection.scopes
    .filter((grant) => grant.granted && grant.scope.id !== scope)
    .map((grant) => grant.scope.id);
}

/** The web only takes access away, and a connection keeps at least one scope. */
export function canRemove(connection: Connection, grant: ScopeGrant): boolean {
  return grant.granted && connection.scopes.filter((item) => item.granted).length > 1;
}

/**
 * The phone's name: the model while it has a push registration, its platform after Backend forgot
 * the model with the registration (a sign-out from here does that).
 */
export function installName(install: Install): string {
  return phoneName(install.platform, install.deviceName);
}

/** "ITMO.Widgets 2.4.0, Android API 36". */
export function installLine(install: Install): string {
  const system = install.os ? osLabel(install.platform, install.os) : PLATFORMS[install.platform];
  return `ITMO.Widgets ${install.version}, ${system}`;
}

/**
 * Whether the install still has a push registration to drop, as far as the answer tells: the
 * registration is what names the device and what makes pushes possible. An install without one was
 * signed out of pushes from another device (`signedOutAt`) or never turned them on.
 */
export function hasPushRegistration(install: Install): boolean {
  return !install.signedOutAt && (install.pushEnabled || install.deviceName !== null);
}

/** Whether the web can turn the phone's notifications off; the calling install signs out in the app. */
export function canTurnOff(install: Install): boolean {
  return hasPushRegistration(install) && !install.current;
}

/**
 * "Активность вчера", with what is known about its notifications when they do not come. Install
 * sign-out comes from the web or from the app on another phone, and Backend does not say which.
 */
export function installActivity(install: Install, now = new Date()): string {
  const seen = `Активность ${formatRelative(install.lastSeenAt, now)}`;
  if (install.signedOutAt) {
    return `${seen} · уведомления отключены ${formatDate(install.signedOutAt, now)} с сайта или другого телефона`;
  }
  if (install.pushEnabled) return seen;
  return hasPushRegistration(install)
    ? `${seen} · уведомления выключены на телефоне`
    : `${seen} · уведомления не включены`;
}

/** What the page is about to end or take away. */
export type Target =
  { connection: Connection } | { install: Install } | { connection: Connection; scope: ScopeGrant };

export interface Confirmation {
  title: string;
  description: string;
  actionLabel: string;
}

/** The confirmation of ending [target]; [self] is the id of this browser's connection. */
export function confirmationOf(target: Target, self: string): Confirmation {
  if ('install' in target) {
    const { install } = target;
    // Off on the phone itself: the registration is still there, and dropping it is what is left.
    const now = install.pushEnabled
      ? `Телефон перестанет получать уведомления ITMO.Widgets. ${STOPS_SPORT}`
      : `Уведомления сейчас выключены на самом телефоне. Если отключить их и здесь, они не придут, даже когда на телефоне их включат снова, — пока приложение не подключит их заново. ${STOPS_SPORT}`;
    return {
      title: `Отключить уведомления на ${installName(install)}?`,
      description: `${now} Вход в ИТМО на нём останется: завершить его можно только в приложении на другом телефоне (${IN_APP}).`,
      actionLabel: 'Отключить уведомления',
    };
  }
  const { connection } = target;
  if ('scope' in target) {
    return {
      title: `Убрать доступ «${target.scope.scope.title}» у ${connection.name}?`,
      description: `${connection.name} потеряет его сразу. Вернуть доступ можно только в приложении: ${IN_APP} → ${connection.name}.`,
      actionLabel: 'Убрать доступ',
    };
  }
  if (connection.id === self) {
    return {
      title: 'Выйти в этом браузере?',
      description: 'Чтобы войти снова, понадобится телефон с приложением.',
      actionLabel: 'Выйти',
    };
  }
  return {
    title: `Отключить ${connection.name}?`,
    description:
      connection.client === 'web'
        ? `${connection.name} сразу выйдет из ITMO.Widgets.`
        : `Доступ к ITMO.Widgets закончится сразу. Вход в ИТМО на нём завершит телефон, когда вы откроете «Устройства» в приложении.`,
    actionLabel: 'Отключить',
  };
}
