import {
  Dumbbell,
  Gavel,
  KeyRound,
  RefreshCw,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { counted, formatNumber, formatRelative, plural } from '../../lib/format';
import {
  CREDENTIAL_LABEL,
  CREDENTIAL_SOON_TEXT,
  credentialState,
  isCredentialBroken,
  SPORT_FAILED_FORMS,
  SPORT_PARTIAL_FORMS,
} from '../../lib/metricLabels';
import { listNames, nameOf } from './labels';
import { sportRows } from './sport';
import type { SportOverview } from './api';
import type {
  AiSummaries,
  CasePage,
  ReviewsSync,
  ServiceCredential,
  SportStatus,
  UserProfile,
} from './types';

/** One thing the visitor should look at, linking to the section where it is handled. */
export interface AttentionRow {
  key: string;
  icon: LucideIcon;
  /** `error` is broken now, `warning` needs a look soon, `accent` waits for the visitor's answer. */
  tone: 'error' | 'warning' | 'accent';
  /** The title says what is wrong: the tone never carries it alone. */
  title: string;
  text?: string;
  href: string;
}

/** Catalog refreshes run every ten minutes; an hour without a success means the automation is stuck. */
const SPORT_STALE_MS = 60 * 60_000;

export function caseRows(page: CasePage, now = new Date()): AttentionRow[] {
  if (page.total <= 0) return [];
  const waiting = plural(page.total, ['заявка ждёт', 'заявки ждут', 'заявок ждут']);
  const oldest = page.items[0]?.openedAt;
  return [
    {
      key: 'cases',
      icon: Gavel,
      tone: 'warning',
      title: `${formatNumber(page.total)} ${waiting} модерации`,
      text: oldest ? `Самая старая пришла ${formatRelative(oldest, now)}` : undefined,
      href: '/admin/moderation',
    },
  ];
}

/**
 * A key that does not work, or a working one that expires soon, under the names and states of
 * Система. The Gemini key is reported by the AI source, which knows whether summaries are on.
 */
export function credentialRows(
  list: readonly ServiceCredential[],
  now = new Date(),
): AttentionRow[] {
  return list.flatMap((credential): AttentionRow[] => {
    if (credential.key === 'GEMINI_API_KEY') return [];
    const name = CREDENTIAL_LABEL[credential.key];
    const state = credentialState(credential);
    const base = { key: `credential-${credential.key}`, icon: KeyRound, href: '/admin/system' };
    if (isCredentialBroken(credential)) {
      return [
        {
          ...base,
          tone: 'error',
          title: `${name}: ${state.label.toLowerCase()}`,
          text: credential.lastErrorAt
            ? `Ошибка ${formatRelative(credential.lastErrorAt, now)}`
            : undefined,
        },
      ];
    }
    if (state.isExpiringSoon) {
      return [
        {
          ...base,
          tone: 'warning',
          title: `${name}: ${CREDENTIAL_SOON_TEXT.toLowerCase()}`,
          text: credential.expiresAt
            ? `Истекает ${formatRelative(credential.expiresAt, now)} · замените значение заранее`
            : 'Замените значение заранее',
        },
      ];
    }
    return [];
  });
}

export function sportAutomationRows(status: SportStatus, now = new Date()): AttentionRow[] {
  const base = { key: 'sport-automation', icon: Dumbbell, href: '/admin/sport' };
  const last = status.lastSuccessAt;
  const lastText = last
    ? `Последний успешный запуск ${formatRelative(last, now)}`
    : 'Успешных запусков ещё не было';
  const stale = last
    ? now.getTime() - new Date(last).getTime() > SPORT_STALE_MS
    : status.runs.length > 0;
  if (stale) {
    return [
      { ...base, tone: 'error', title: 'Автозапись на спорт не обновляется', text: lastText },
    ];
  }
  // Failed runs only, the figure Система shows as "Сбои"; partial runs are counted apart there
  // and here, never added to them.
  const failed = status.outcomes7d.FAILED ?? 0;
  const partial = status.outcomes7d.PARTIAL ?? 0;
  if (failed > 0) {
    return [
      {
        ...base,
        tone: 'warning',
        title: `Автозапись: ${counted(failed, SPORT_FAILED_FORMS)} за 7 дней`,
        text: partial > 0 ? `Ещё ${counted(partial, SPORT_PARTIAL_FORMS)}. ${lastText}` : lastText,
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
        icon: Sparkles,
        tone: 'error',
        title: keyProblem,
        text: 'ИИ-сводки не строятся',
        href: '/admin/system',
      },
    ];
  }
  const base = { key: 'ai', icon: Sparkles, href: '/admin/reviews' };
  if (ai.dailyBudget > 0 && ai.budgetUsed >= ai.dailyBudget) {
    return [
      {
        ...base,
        tone: 'warning',
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
        tone: quiet ? 'warning' : 'error',
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
      icon: RefreshCw,
      tone: 'error',
      title: 'Синхронизация отзывов не удалась',
      text: sync.lastCheckedAt ? formatRelative(sync.lastCheckedAt, now) : undefined,
      href: '/admin/reviews',
    },
  ];
}

/** A place that can be taken does not wait: each notified queue is a row of its own. */
export function freedPlaceRows(sport: SportOverview): AttentionRow[] {
  return sportRows(sport).flatMap((row): AttentionRow[] =>
    row.freed
      ? [
          {
            key: `sport-${row.id}`,
            icon: Dumbbell,
            tone: 'accent',
            title: `${row.title}: ${row.freed}`,
            text: `${row.when} · записывает телефон с приложением`,
            href: '/sport',
          },
        ]
      : [],
  );
}

export function requestRows(requests: readonly UserProfile[]): AttentionRow[] {
  if (requests.length === 0) return [];
  return [
    {
      key: 'requests',
      icon: UserPlus,
      tone: 'accent',
      title: `${counted(requests.length, ['заявка', 'заявки', 'заявок'])} в друзья`,
      text: listNames(requests.map((request) => nameOf(request.user))),
      href: '/friends?tab=incoming',
    },
  ];
}
