import type { BadgeTone } from '../../ui';
import type {
  CredentialSource,
  ServiceCredentialKey,
  ServiceCredentialStatus,
  SportErrorCategory,
  SportOutcome,
} from './types';

export const OUTCOMES: Record<SportOutcome, { label: string; tone: BadgeTone; icon: string }> = {
  SUCCESS: { label: 'Успешно', tone: 'success', icon: 'check_circle' },
  PARTIAL: { label: 'Частично', tone: 'warning', icon: 'warning' },
  FAILED: { label: 'Сбой', tone: 'error', icon: 'error' },
};

export const ERROR_CATEGORIES: Record<SportErrorCategory, string> = {
  AUTH: 'Авторизация',
  NETWORK: 'Сеть',
  HTTP: 'Ответ сервера',
  MAPPING: 'Разбор данных',
  PERSISTENCE: 'База данных',
  INTERNAL: 'Внутренняя ошибка',
};

export const CREDENTIALS: Record<ServiceCredentialKey, string> = {
  MY_ITMO_REFRESH_TOKEN: 'My ITMO · refresh-токен',
  MY_ITMO_ACCESS_TOKEN: 'My ITMO · access-токен',
  MY_ITMO_ID_TOKEN: 'My ITMO · ID-токен',
  ISU_KEYCLOAK_IDENTITY: 'ИСУ · cookie KEYCLOAK_IDENTITY',
  GEMINI_API_KEY: 'Gemini · API-ключ',
};

export const CREDENTIAL_STATUSES: Record<
  ServiceCredentialStatus,
  { label: string; tone: BadgeTone }
> = {
  OK: { label: 'Работает', tone: 'success' },
  UNKNOWN: { label: 'Не проверено', tone: 'neutral' },
  EXPIRED: { label: 'Истекло', tone: 'error' },
  FAILED: { label: 'Ошибка', tone: 'error' },
  MISSING: { label: 'Нет значения', tone: 'warning' },
};

/** `ADMIN` is shown as the admin's name instead. */
export const CREDENTIAL_SOURCES: Record<Exclude<CredentialSource, 'ADMIN'>, string> = {
  MIGRATION: 'перенесено при обновлении',
  SEED: 'из окружения',
  ROTATION: 'сервером',
};
