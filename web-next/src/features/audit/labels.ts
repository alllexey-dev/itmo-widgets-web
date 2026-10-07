import type { components } from '../../api/schema';

export type AuditEntry = components['schemas']['AdminAuditEntry'];

/** The actions of Backend `docs/contracts/admin.md` (Audit); an unknown one is shown as its name. */
export const ACTIONS: Record<string, { label: string; icon: string }> = {
  ROLE_GRANTED: { label: 'Выдана роль', icon: 'person_add' },
  ROLE_REVOKED: { label: 'Снята роль', icon: 'person_remove' },
  MODERATION_SETTINGS_CHANGED: { label: 'Правила модерации', icon: 'tune' },
  APP_VERSION_CHANGED: { label: 'Версия приложения', icon: 'upgrade' },
  REVIEWS_SYNC_STARTED: { label: 'Синхронизация отзывов', icon: 'sync' },
  SERVICE_CREDENTIAL_REPLACED: { label: 'Замена учётных данных', icon: 'key' },
  AI_SUMMARIES_RUN_STARTED: { label: 'Пересчёт ИИ-сводок', icon: 'wand_stars' },
  AI_SUMMARY_HIDDEN: { label: 'Сводка скрыта', icon: 'visibility_off' },
  AI_SUMMARY_SHOWN: { label: 'Сводка показана', icon: 'visibility' },
  AI_SUMMARY_REGENERATION_REQUESTED: { label: 'Пересчёт сводки', icon: 'refresh' },
};

const TARGETS: Record<string, string> = {
  'moderation-settings': 'Настройки модерации',
  'app-version': 'Версия приложения',
  'reviews-sync': 'Отзывы',
  'ai-summaries': 'ИИ-сводки',
  'credential:MY_ITMO_REFRESH_TOKEN': 'My ITMO · refresh-токен',
  'credential:ISU_KEYCLOAK_IDENTITY': 'ИСУ · cookie KEYCLOAK_IDENTITY',
  'credential:GEMINI_API_KEY': 'Gemini · API-ключ',
};

export type Target = { kind: 'user'; isu: number } | { kind: 'text'; text: string };

export function targetOf(target: string): Target {
  const user = /^user:(\d+)$/.exec(target);
  if (user) return { kind: 'user', isu: Number(user[1]) };
  const teacher = /^teacher:(\d+)$/.exec(target);
  if (teacher) return { kind: 'text', text: `Преподаватель · ИСУ ${teacher[1]}` };
  return { kind: 'text', text: TARGETS[target] ?? target };
}

const IOS_PREFIX = 'IOS: ';

/**
 * App version changes name their platform: Backend prefixes iOS details with `IOS: ` (BK-17); entries
 * without it, including every one written before BK-17, are Android. Other actions have no platform.
 */
export function detailsOf(entry: AuditEntry): { platform: string | null; text: string | null } {
  if (entry.action !== 'APP_VERSION_CHANGED') return { platform: null, text: entry.details };
  const details = entry.details ?? '';
  if (details.startsWith(IOS_PREFIX)) {
    return { platform: 'iOS', text: details.slice(IOS_PREFIX.length) || null };
  }
  return { platform: 'Android', text: entry.details };
}
