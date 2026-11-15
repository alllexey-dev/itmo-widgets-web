import {
  Bot,
  BotOff,
  CircleArrowUp,
  Dumbbell,
  Eye,
  EyeOff,
  History,
  KeyRound,
  RefreshCw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { CREDENTIAL_LABEL } from '../../lib/metricLabels';
import type { AuditEntry } from './types';

export interface Action {
  label: string;
  icon: LucideIcon;
  /** False for an action this web does not know: its label is Backend's own name. */
  isKnown: boolean;
}

/** The actions of Backend `docs/contracts/admin.md` (Audit), named by what happened. */
const ACTIONS: Record<string, Omit<Action, 'isKnown'> | undefined> = {
  ROLE_GRANTED: { label: 'Выдана роль', icon: UserPlus },
  ROLE_REVOKED: { label: 'Снята роль', icon: UserMinus },
  AGENT_ACCESS_GRANTED: { label: 'Открыт доступ к агентам', icon: Bot },
  AGENT_ACCESS_REVOKED: { label: 'Закрыт доступ к агентам', icon: BotOff },
  MODERATION_SETTINGS_CHANGED: { label: 'Изменены правила модерации', icon: SlidersHorizontal },
  SPORT_SETTINGS_CHANGED: { label: 'Изменён лимит автозаписи', icon: Dumbbell },
  APP_VERSION_CHANGED: { label: 'Изменена версия приложения', icon: CircleArrowUp },
  REVIEWS_SYNC_STARTED: { label: 'Запущена синхронизация отзывов', icon: RefreshCw },
  SERVICE_CREDENTIAL_REPLACED: { label: 'Заменён ключ', icon: KeyRound },
  AI_SUMMARIES_RUN_STARTED: { label: 'Запущен пересчёт ИИ-сводок', icon: Sparkles },
  AI_SUMMARY_HIDDEN: { label: 'Сводка скрыта', icon: EyeOff },
  AI_SUMMARY_SHOWN: { label: 'Сводка показана', icon: Eye },
  AI_SUMMARY_REGENERATION_REQUESTED: { label: 'Запрошен пересчёт сводки', icon: RotateCw },
};

export function actionOf(action: string): Action {
  const known = ACTIONS[action];
  return known ? { ...known, isKnown: true } : { label: action, icon: History, isKnown: false };
}

/** The places of the cabinet where the logged changes are made. */
const KEYS = '/admin/system?tab=keys';
const REVIEWS = '/admin/reviews';

/** The keys as every page names them; one a later Backend adds is not among them. */
const CREDENTIALS: Record<string, string | undefined> = CREDENTIAL_LABEL;

/** The parts of the system an entry may name, as their forms call them, with the form's address. */
const PLACES: Record<string, { text: string; href: string } | undefined> = {
  'moderation-settings': { text: 'Правила модерации', href: '/admin/system?tab=moderation' },
  'sport-settings': { text: 'Автозапись на спорт', href: '/admin/system?tab=sport' },
  'app-version': { text: 'Версия приложения', href: '/admin/system?tab=versions' },
  'reviews-sync': { text: 'Отзывы', href: REVIEWS },
  'ai-summaries': { text: 'ИИ-сводки', href: REVIEWS },
};

export type Target =
  /** A user: the page shows the name it finds and links to the card. */
  | { kind: 'user'; isu: number }
  /** A named part of the system, with the page where it is changed. */
  | { kind: 'place'; text: string; href: string }
  /** A target this web does not know: Backend's own text. */
  | { kind: 'raw'; text: string };

/** What the action touched. */
export function targetOf(target: string): Target {
  const user = /^user:(\d+)$/.exec(target);
  if (user) return { kind: 'user', isu: Number(user[1]) };
  const teacher = /^teacher:(\d+)$/.exec(target);
  if (teacher) return { kind: 'place', text: `Преподаватель · ИСУ ${teacher[1]}`, href: REVIEWS };
  const key = /^credential:(.+)$/.exec(target)?.[1];
  const credential = key === undefined ? undefined : CREDENTIALS[key];
  if (credential) return { kind: 'place', text: credential, href: KEYS };
  const place = PLACES[target];
  return place ? { kind: 'place', ...place } : { kind: 'raw', text: target };
}

/** One line of the details: words of the cabinet, or Backend's own notation when it has none. */
export interface DetailLine {
  text: string;
  isRaw: boolean;
}

export interface Details {
  /** The platform of an app version change; null for every other action. */
  platform: string | null;
  /** What changed, one change per line; empty when Backend wrote nothing. */
  lines: DetailLine[];
}

const ROLES: Record<string, string | undefined> = {
  MODERATOR: 'Модератор',
  ADMIN: 'Администратор',
};

/** The two moderation policies, as the rules form names them. */
const POLICIES: Record<string, { name: string; submissions: string } | undefined> = {
  SUBJECT_RESOURCE: { name: 'Ссылки', submissions: 'Ссылок в сутки' },
  TEACHER_REVIEW: { name: 'Отзывы', submissions: 'Отзывов в сутки' },
};

/** The limits of a policy that read the same for both, as the rules form labels them. */
const POLICY_FIELDS: Record<string, string | undefined> = {
  premoderation: 'Премодерация',
  report_threshold: 'Жалоб до проверки',
  vote_threshold: 'Рейтинг для проверки',
  daily_report_limit: 'Жалоб в сутки',
};

const SWITCH: Record<string, string | undefined> = { true: 'включена', false: 'выключена' };

/** `key old -> new`, the way Backend writes one changed value. */
const CHANGE = /^(\S+) (.*) -> (.*)$/;

const raw = (text: string): DetailLine => ({ text, isRaw: true });
const plain = (text: string): DetailLine => ({ text, isRaw: false });

/** A value as the forms show it: a negative number with a real minus. */
function shown(value: string): string {
  return /^-\d+$/.test(value) ? `−${value.slice(1)}` : value;
}

function changed(label: string, from: string, to: string): DetailLine {
  return plain(`${label}: ${shown(from)} → ${shown(to)}`);
}

/** `SUBJECT_RESOURCE.report_threshold 3 -> 5` as `Ссылки · Жалоб до проверки: 3 → 5`. */
function policyChange(line: string): DetailLine {
  const [, key = '', from = '', to = ''] = CHANGE.exec(line) ?? [];
  const [type = '', field = ''] = key.split('.');
  const policy = POLICIES[type];
  if (!policy) return raw(line);
  // The daily limit of submissions names its policy by itself.
  if (field === 'daily_submission_limit') return changed(policy.submissions, from, to);
  const label = POLICY_FIELDS[field];
  if (!label) return raw(line);
  return field === 'premoderation'
    ? changed(`${policy.name} · ${label}`, SWITCH[from] ?? from, SWITCH[to] ?? to)
    : changed(`${policy.name} · ${label}`, from, to);
}

/** `latest 2.1 -> 2.3`, `minimum ...` and `note changed`, as the version form labels its fields. */
function versionChange(line: string): DetailLine {
  if (line === 'note changed') return plain('«Что нового» изменено');
  const [, key, from = '', to = ''] = CHANGE.exec(line) ?? [];
  if (key === 'latest') return changed('Последняя', from, to);
  if (key === 'minimum') return changed('Минимальная', from, to);
  return raw(line);
}

function sportChange(line: string): DetailLine {
  const [, key, from = '', to = ''] = CHANGE.exec(line) ?? [];
  return key === 'autoSignLimit' ? changed('Лимит автозаписи в месяц', from, to) : raw(line);
}

function roleChange(line: string): DetailLine {
  const role = /^role (\S+)$/.exec(line)?.[1] ?? '';
  const label = ROLES[role];
  return label ? plain(label) : raw(line);
}

const IOS_PREFIX = 'IOS: ';

/** Backend separates the changes of one entry with `; `. */
function linesOf(details: string): string[] {
  return details
    .split('; ')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * The details of an entry in the words of the forms that make the change. Backend writes them in
 * its own notation (`docs/contracts/admin.md`, Audit); a line this web cannot read stays as sent.
 *
 * An app version change names its platform: Backend prefixes iOS details with `IOS: `; entries
 * without it, including every one written before per-platform versions, are Android.
 */
export function detailsOf(entry: AuditEntry): Details {
  const details = entry.details ?? '';
  switch (entry.action) {
    case 'ROLE_GRANTED':
    case 'ROLE_REVOKED':
      return { platform: null, lines: linesOf(details).map(roleChange) };
    case 'APP_VERSION_CHANGED': {
      const isIos = details.startsWith(IOS_PREFIX);
      return {
        platform: isIos ? 'iOS' : 'Android',
        lines: linesOf(isIos ? details.slice(IOS_PREFIX.length) : details).map(versionChange),
      };
    }
    case 'MODERATION_SETTINGS_CHANGED':
      return { platform: null, lines: linesOf(details).map(policyChange) };
    case 'SPORT_SETTINGS_CHANGED':
      return { platform: null, lines: linesOf(details).map(sportChange) };
    default:
      return { platform: null, lines: linesOf(details).map(raw) };
  }
}

/** A user who has not uploaded a name yet still needs something to click. */
export function nameOrFallback(name: string): string {
  return name.trim() || 'Без имени';
}
