import type { GroupOption, StatusTone } from '@alllexey/ui';
import type {
  CredentialSource,
  Platform,
  ServiceCredentialKey,
  ServiceCredentialStatus,
  SportErrorCategory,
  SportOutcome,
} from './types';

export const PLATFORM_NAMES: Record<Platform, string> = { ANDROID: 'Android', IOS: 'iOS' };

export const PLATFORMS: GroupOption<Platform>[] = [
  { value: 'ANDROID', label: PLATFORM_NAMES.ANDROID, icon: 'android' },
  { value: 'IOS', label: PLATFORM_NAMES.IOS, icon: 'smartphone' },
];

export const SPORT_OUTCOMES: Record<SportOutcome, { label: string; tone: StatusTone }> = {
  SUCCESS: { label: 'Успешно', tone: 'ok' },
  PARTIAL: { label: 'Частично', tone: 'warn' },
  FAILED: { label: 'Сбой', tone: 'bad' },
};

/** The headline state of the automation, by the latest run. */
export const SPORT_HEALTH: Record<SportOutcome, string> = {
  SUCCESS: 'Работает',
  PARTIAL: 'С ошибками',
  FAILED: 'Последний запуск упал',
};

export const SPORT_ERRORS: Record<SportErrorCategory, string> = {
  AUTH: 'Авторизация',
  NETWORK: 'Сеть',
  HTTP: 'Ответ сервера',
  MAPPING: 'Разбор данных',
  PERSISTENCE: 'База данных',
  INTERNAL: 'Внутренняя ошибка',
};

export const CREDENTIALS: Record<ServiceCredentialKey, string> = {
  MY_ITMO_REFRESH_TOKEN: 'My ITMO, refresh-токен',
  MY_ITMO_ACCESS_TOKEN: 'My ITMO, access-токен',
  MY_ITMO_ID_TOKEN: 'My ITMO, ID-токен',
  ISU_KEYCLOAK_IDENTITY: 'Cookie ИСУ (KEYCLOAK_IDENTITY)',
  GEMINI_API_KEY: 'Ключ Gemini',
};

export const CREDENTIAL_HINTS: Partial<Record<ServiceCredentialKey, string>> = {
  ISU_KEYCLOAK_IDENTITY: 'Cookie KEYCLOAK_IDENTITY с id.itmo.ru',
  MY_ITMO_REFRESH_TOKEN: 'Refresh-токен технического аккаунта; access- и ID-токен обновятся сами',
  GEMINI_API_KEY: 'Ключ из Google AI Studio',
};

export const CREDENTIAL_STATUSES: Record<
  ServiceCredentialStatus,
  { label: string; tone: StatusTone }
> = {
  OK: { label: 'Работает', tone: 'ok' },
  UNKNOWN: { label: 'Не проверено', tone: 'neutral' },
  EXPIRED: { label: 'Истекло', tone: 'bad' },
  FAILED: { label: 'Ошибка', tone: 'bad' },
  MISSING: { label: 'Нет значения', tone: 'warn' },
};

/** `ADMIN` is shown as the admin's name instead. */
export const CREDENTIAL_SOURCES: Record<Exclude<CredentialSource, 'ADMIN'>, string> = {
  MIGRATION: 'перенесено при обновлении',
  SEED: 'из окружения',
  ROTATION: 'сервером',
};
