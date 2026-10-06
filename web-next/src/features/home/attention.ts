import { counted, formatNumber, formatRelative, plural } from '../../lib/format';
import type {
  AiSummaries,
  CredentialKey,
  ReviewsSync,
  ServiceCredential,
  SportStatus,
} from './types';

/** One thing a staff member should look at, linking to the section where it is handled. */
export interface AttentionRow {
  key: string;
  icon: string;
  /** `bad` is broken now, `warn` needs a look soon. The title says which: never colour alone. */
  tone: 'bad' | 'warn';
  title: string;
  text?: string;
  to: string;
}

/** Catalog refreshes run every ten minutes; an hour without a success means the automation is stuck. */
const SPORT_STALE_MS = 60 * 60_000;

export function caseRows(total: number): AttentionRow[] {
  if (total <= 0) return [];
  const waiting = plural(total, ['заявка ждёт', 'заявки ждут', 'заявок ждут']);
  return [
    {
      key: 'cases',
      icon: 'gavel',
      tone: 'warn',
      title: `${formatNumber(total)} ${waiting} решения`,
      to: '/admin/moderation',
    },
  ];
}

const CREDENTIAL_NAMES: Record<Exclude<CredentialKey, 'GEMINI_API_KEY'>, string> = {
  MY_ITMO_REFRESH_TOKEN: 'Refresh-токен My ITMO',
  MY_ITMO_ACCESS_TOKEN: 'Access-токен My ITMO',
  MY_ITMO_ID_TOKEN: 'ID-токен My ITMO',
  ISU_KEYCLOAK_IDENTITY: 'Cookie ИСУ',
};

/** The Gemini key is reported by the AI source, which knows whether summaries are on. */
export function credentialRows(
  list: readonly ServiceCredential[],
  now = new Date(),
): AttentionRow[] {
  return list.flatMap((credential): AttentionRow[] => {
    if (credential.key === 'GEMINI_API_KEY') return [];
    const name = CREDENTIAL_NAMES[credential.key];
    const base = { key: `credential-${credential.key}`, icon: 'key', to: '/admin/system' };
    const since = credential.lastErrorAt
      ? `Ошибка ${formatRelative(credential.lastErrorAt, now)}`
      : undefined;
    if (credential.status === 'FAILED') {
      return [{ ...base, tone: 'bad', title: `${name}: ошибка`, text: since }];
    }
    if (credential.status === 'EXPIRED') {
      return [{ ...base, tone: 'bad', title: `${name}: срок истёк`, text: since }];
    }
    if (credential.expiresSoon && credential.expiresAt) {
      return [
        {
          ...base,
          tone: 'warn',
          title: `${name} истекает ${formatRelative(credential.expiresAt, now)}`,
          text: 'Замените значение заранее',
        },
      ];
    }
    return [];
  });
}

export function sportRows(status: SportStatus, now = new Date()): AttentionRow[] {
  const base = { key: 'sport', icon: 'fitness_center', to: '/admin/sport' };
  const last = status.lastSuccessAt;
  const lastText = last
    ? `Последний успешный запуск ${formatRelative(last, now)}`
    : 'Успешных запусков ещё не было';
  const stale = last
    ? now.getTime() - new Date(last).getTime() > SPORT_STALE_MS
    : status.runs.length > 0;
  if (stale) {
    return [{ ...base, tone: 'bad', title: 'Автозапись на спорт не обновляется', text: lastText }];
  }
  const failed = status.outcomes7d.FAILED ?? 0;
  if (failed > 0) {
    return [
      {
        ...base,
        tone: 'warn',
        title: `Автозапись: ${counted(failed, ['сбой', 'сбоя', 'сбоев'])} за 7 дней`,
        text: lastText,
      },
    ];
  }
  return [];
}

const KEY_PROBLEMS: Partial<Record<AiSummaries['keyStatus'], string>> = {
  MISSING: 'Нет ключа Gemini',
  FAILED: 'Ключ Gemini не принят',
  EXPIRED: 'Срок ключа Gemini истёк',
};

const RUN_PROBLEMS: Partial<Record<NonNullable<AiSummaries['lastOutcome']>, string>> = {
  BUDGET_EXHAUSTED: 'закончился лимит запросов',
  RATE_LIMITED: 'ограничение Google',
  NO_KEY: 'нет ключа',
  AUTH_FAILED: 'ключ не принят',
  FAILED: 'ошибка',
};

/** One row at most: the key first, then today's budget, then the latest run. Nothing when AI is off. */
export function aiRows(ai: AiSummaries, now = new Date()): AttentionRow[] {
  if (!ai.enabled) return [];
  const keyProblem = KEY_PROBLEMS[ai.keyStatus];
  if (keyProblem) {
    return [
      {
        key: 'ai',
        icon: 'wand_stars',
        tone: 'bad',
        title: keyProblem,
        text: 'ИИ-сводки не строятся',
        to: '/admin/system',
      },
    ];
  }
  const base = { key: 'ai', icon: 'wand_stars', to: '/admin/reviews' };
  if (ai.dailyBudget > 0 && ai.budgetUsed >= ai.dailyBudget) {
    return [
      {
        ...base,
        tone: 'warn',
        title: 'Лимит ИИ-запросов на сегодня исчерпан',
        text: `${formatNumber(ai.budgetUsed)} из ${formatNumber(ai.dailyBudget)}`,
      },
    ];
  }
  const runProblem = ai.lastOutcome ? RUN_PROBLEMS[ai.lastOutcome] : undefined;
  if (runProblem) {
    const quiet = ai.lastOutcome === 'BUDGET_EXHAUSTED' || ai.lastOutcome === 'RATE_LIMITED';
    return [
      {
        ...base,
        tone: quiet ? 'warn' : 'bad',
        title: `Пересчёт ИИ-сводок: ${runProblem}`,
        text: ai.lastFinishedAt ? formatRelative(ai.lastFinishedAt, now) : undefined,
      },
    ];
  }
  return [];
}

export function reviewsRows(sync: ReviewsSync, now = new Date()): AttentionRow[] {
  if (!sync.enabled || sync.lastOutcome !== 'FAILED') return [];
  return [
    {
      key: 'reviews',
      icon: 'sync',
      tone: 'bad',
      title: 'Синхронизация отзывов не удалась',
      text: sync.lastCheckedAt ? formatRelative(sync.lastCheckedAt, now) : undefined,
      to: '/admin/reviews',
    },
  ];
}
