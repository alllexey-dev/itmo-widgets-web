// One set of names for the figures and states that more than one page shows: Главная, Статистика
// and Система read the same Backend fields, so they name them with the same words. A page keeps its
// own labels only for what it alone shows.
import type { StatusDotVariant } from '@astryxdesign/core/StatusDot';
import type { components } from '../api/schema';
import { SPORT_KIND_LABEL } from './sportLabels';

type Schemas = components['schemas'];

// ---------------------------------------------------------------- figures of the dashboard

/**
 * The name of a figure, by what Backend counts:
 * - `users`, `newUsers`: accounts by their first ITMO ID sign-in;
 * - `activeDevices`: `AdminDashboard` `activeDevices7d` / `activeDevices30d`, phones the app
 *   registered on Backend, by the time of their last login;
 * - `activeClients`: `AdminClients`, app installs and connections (web, agent, MCP) that made
 *   requests. It is another figure than `activeDevices`, counted from another table, so the two
 *   names never stand for each other;
 * - `activePeople`: `AdminAudienceStats.activePeople` / `peopleHistory`, distinct people by the
 *   latest activity of any of their clients, devices or connections. A person with a phone and a
 *   browser is one, so it is a third figure next to `activeDevices` and `activeClients`;
 * - `webSessions`: `webSessions7d`, web connections created (a browser connected to an account);
 * - `serverErrors`: the share of 5xx answers, `AdminServerDay.errors5xx / requests`;
 * - `sportSignups`: entries of both kinds that got a place, `AdminSportStatsDay.signUps`.
 */
export const METRIC_LABEL = {
  users: 'Пользователи',
  newUsers: 'Новые пользователи',
  activeDevices: 'Активные устройства',
  activeClients: 'Активные клиенты',
  activePeople: 'Активные люди',
  webSessions: 'Входы на сайт',
  friendships: 'Дружбы',
  newLinks: 'Новые ссылки',
  openCases: 'Открытые заявки',
  serverErrors: 'Ошибки сервера',
  sportSignups: 'Записи на спорт',
} as const;

/** What a web sign-in counts, for the hint next to `webSessions`. */
export const WEB_SESSIONS_HINT =
  'Сколько раз за 7 дней браузер подключили к аккаунту с телефона. Это не посещения: один вход действует до 30 дней.';

// ---------------------------------------------------------------- sport

type SportOutcome = Schemas['AdminSportRun']['outcome'];

/** The outcome of one run of the catalog refresh. */
export const SPORT_OUTCOME_LABEL: Record<SportOutcome, string> = {
  SUCCESS: 'Успешно',
  PARTIAL: 'Частично',
  FAILED: 'Сбой',
};

export const SPORT_OUTCOME_TONE: Record<SportOutcome, StatusDotVariant> = {
  SUCCESS: 'success',
  PARTIAL: 'warning',
  FAILED: 'error',
};

/**
 * Runs of a period that did not go well, as two figures: failed runs are "Сбои", partial runs
 * "Частично". They are never added up under one word.
 */
export const SPORT_RUNS_LABEL = {
  failed: 'Сбои',
  partial: 'Частично',
} as const;

/** "6 сбоев": the plural forms of a count of failed runs. */
export const SPORT_FAILED_FORMS = ['сбой', 'сбоя', 'сбоев'] as const;
/** "11 частичных запусков": the plural forms of a count of partial runs. */
export const SPORT_PARTIAL_FORMS = [
  'частичный запуск',
  'частичных запуска',
  'частичных запусков',
] as const;

/**
 * Entries that wait for a place, by kind, in the words of `sportLabels.ts`:
 * `activeAutoSignEntries` is "Автозапись", `activeFreeSignEntries` is "Очередь на место".
 */
export const SPORT_WAITING_LABEL = {
  auto: SPORT_KIND_LABEL.auto,
  free: SPORT_KIND_LABEL.free,
  /** Both kinds together. */
  all: 'Ждут места на спорт',
} as const;

// ---------------------------------------------------------------- service credentials

type Credential = Schemas['AdminServiceCredential'];

export const CREDENTIAL_LABEL: Record<Credential['key'], string> = {
  MY_ITMO_REFRESH_TOKEN: 'My ITMO, refresh-токен',
  MY_ITMO_ACCESS_TOKEN: 'My ITMO, access-токен',
  MY_ITMO_ID_TOKEN: 'My ITMO, ID-токен',
  ISU_KEYCLOAK_IDENTITY: 'Cookie ИСУ (KEYCLOAK_IDENTITY)',
  GEMINI_API_KEY: 'Ключ Gemini',
};

/** The state of a key is its status; an approaching expiry is a tag next to it, not a state. */
export const CREDENTIAL_STATUS: Record<
  Credential['status'],
  { label: string; tone: StatusDotVariant }
> = {
  OK: { label: 'Работает', tone: 'success' },
  UNKNOWN: { label: 'Не проверено', tone: 'neutral' },
  EXPIRED: { label: 'Истекло', tone: 'error' },
  FAILED: { label: 'Ошибка', tone: 'error' },
  MISSING: { label: 'Нет значения', tone: 'warning' },
};

/** The tag of a working key that expires soon (`expiresSoon`), and the same in a sentence. */
export const CREDENTIAL_SOON = 'Скоро';
export const CREDENTIAL_SOON_TEXT = 'Скоро истекает';

/** The columns and facts of a key. */
export const CREDENTIAL_FIELD = {
  name: 'Ключ',
  state: 'Состояние',
  expires: 'Истекает',
  used: 'Использован',
  changed: 'Изменено',
} as const;

export interface CredentialState {
  label: string;
  tone: StatusDotVariant;
  /** A working key with less than its warning window left: shown as the "Скоро" tag. */
  isExpiringSoon: boolean;
}

/** The one state model of a key for every page that shows it. */
export function credentialState(
  credential: Pick<Credential, 'status' | 'expiresSoon'>,
): CredentialState {
  return {
    ...CREDENTIAL_STATUS[credential.status],
    isExpiringSoon: credential.expiresSoon && credential.status === 'OK',
  };
}

/**
 * A key that does not work and has to be replaced. A missing value counts only for a key an admin
 * can replace: the access and ID tokens are empty for a moment after the refresh token changes,
 * and Backend fills them by itself on its next request.
 */
export function isCredentialBroken(
  credential: Pick<Credential, 'status' | 'replaceable'>,
): boolean {
  return (
    credential.status === 'EXPIRED' ||
    credential.status === 'FAILED' ||
    (credential.status === 'MISSING' && credential.replaceable)
  );
}

// ---------------------------------------------------------------- reviews

/** The copy of the external reviews base: the job that brings it up to date, and its running state. */
export const SYNC_NAME = 'Синхронизация';
export const SYNC_RUNNING = 'Идёт синхронизация';

/** The ISU check of a review: whether the teacher taught its author. */
export const REVIEW_CHECK_NAME = 'Проверка по ИСУ';
export const REVIEW_CHECK_LABEL = {
  pending: 'На проверке',
  verified: 'Подтверждено',
  unverified: 'Не подтверждено',
} as const;

// ---------------------------------------------------------------- app versions

/** Where a version stands against the announced latest and minimum of its platform. */
export type VersionState = 'unknown' | 'latest' | 'beta' | 'supported' | 'old';

export const VERSION_STATE: Record<
  VersionState,
  { label: string; color: 'green' | 'purple' | 'gray' | 'orange' }
> = {
  unknown: { label: 'Неизвестно', color: 'gray' },
  latest: { label: 'Актуальная', color: 'green' },
  beta: { label: 'Бета', color: 'purple' },
  supported: { label: 'Предыдущая', color: 'gray' },
  old: { label: 'Устарела', color: 'orange' },
};

/** Devices that never reported a build: the row of every version list, and why it exists. */
export const UNKNOWN_VERSION = {
  label: 'Версия неизвестна',
  note: 'Android 2.2 и старше или не обновлялись',
} as const;

/** A client that did not name its OS or browser, and the folded tail of a breakdown. */
export const UNKNOWN_PLATFORM = 'Не указано';
export const OTHERS = 'Другие';

/** A build of the official app and a build made by someone else. */
export const BUILD_KIND = { official: 'Официальная', custom: 'Своя' } as const;
