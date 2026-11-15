import { formatDate, formatDateTime } from '../../lib/format';
import type {
  CredentialSource,
  Platform,
  PolicyKey,
  ServiceCredentialKey,
  SportErrorCategory,
  SportOutcome,
} from './types';

export const PLATFORM_NAMES: Record<Platform, string> = { ANDROID: 'Android', IOS: 'iOS' };
export const PLATFORMS: readonly Platform[] = ['ANDROID', 'IOS'];

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

export const CREDENTIAL_HINTS: Partial<Record<ServiceCredentialKey, string>> = {
  ISU_KEYCLOAK_IDENTITY: 'Cookie KEYCLOAK_IDENTITY с id.itmo.ru',
  MY_ITMO_REFRESH_TOKEN: 'Refresh-токен технического аккаунта; access- и ID-токен обновятся сами',
  GEMINI_API_KEY: 'Ключ из Google AI Studio',
};

/** What Backend does with a new value, shown before it is sent. */
export const CREDENTIAL_EFFECTS: Partial<Record<ServiceCredentialKey, string>> = {
  ISU_KEYCLOAK_IDENTITY:
    'Сервер сразу войдёт в ИСУ с новой cookie и запустит отложенные проверки отзывов.',
  MY_ITMO_REFRESH_TOKEN:
    'Access- и ID-токен сбросятся; сервер получит новые при следующем запросе к My ITMO.',
  GEMINI_API_KEY: 'Новый ключ возьмёт следующий запрос ИИ-сводки.',
};

/** What a value has to be, said when one is refused. */
export const CREDENTIAL_VALUE_RULE =
  'От 20 до 8192 символов без пробелов: латинские буквы, цифры и знаки, кроме ; , " и \\';

const TWO_DAYS = 2 * 24 * 60 * 60_000;

/** When a value expires: the day, and the time too when it is less than two days away. */
export function expiryText(expiresAt: string, now: Date = new Date()): string {
  const isNear = Math.abs(Date.parse(expiresAt) - now.getTime()) < TWO_DAYS;
  return isNear ? formatDateTime(expiresAt, now) : formatDate(expiresAt, now);
}

/** `ADMIN` is shown as the admin's name instead. */
export const CREDENTIAL_SOURCES: Record<Exclude<CredentialSource, 'ADMIN'>, string> = {
  MIGRATION: 'перенесено при обновлении',
  SEED: 'из окружения',
  ROTATION: 'сервером',
};

export const POLICIES: readonly PolicyKey[] = ['SUBJECT_RESOURCE', 'TEACHER_REVIEW'];

export const POLICY_NAMES: Record<PolicyKey, string> = {
  SUBJECT_RESOURCE: 'Ссылки',
  TEACHER_REVIEW: 'Отзывы',
};

export const SUBMISSION_LABELS: Record<PolicyKey, string> = {
  SUBJECT_RESOURCE: 'Ссылок в сутки',
  TEACHER_REVIEW: 'Отзывов в сутки',
};
