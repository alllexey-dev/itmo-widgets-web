import { TIME_ZONE } from '../../lib/format';
import { isKnownAction, TARGET_TYPES } from './labels';

/**
 * The filters of `GET /api/admin/audit` (`docs/contracts/admin.md`, Audit), as the address keeps
 * them under the same names. Every one is optional; an empty string is "any".
 */
export interface AuditFilters {
  /** The acting administrator's ISU. */
  actorIsu: string;
  /** One action of the log. */
  action: string;
  /** The kind of target: the part of `target` before the colon, or a whole target without one. */
  targetType: string;
  /** One whole target, `user:123456`: everything about one user. */
  target: string;
  /** The first and the last Moscow day of the entries, `YYYY-MM-DD`, both inclusive. */
  from: string;
  to: string;
}

/** The address of the page: the filters and the zero-based page. */
export const AUDIT_QUERY = {
  page: 0,
  actorIsu: '',
  action: '',
  targetType: '',
  target: '',
  from: '',
  to: '',
};

/** Clears every filter at once, for the address setter. */
export const NO_FILTERS: Record<keyof AuditFilters, null> = {
  actorIsu: null,
  action: null,
  targetType: null,
  target: null,
  from: null,
  to: null,
};

/** A `YYYY-MM-DD` that names a real day. */
export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const moscowDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today in Moscow, `YYYY-MM-DD`: the log has nothing later. */
export function moscowToday(now: Date = new Date()): string {
  return moscowDay.format(now);
}

const TYPES = new Set(TARGET_TYPES.map((type) => type.value));

/**
 * The filters an address holds, keeping only what Backend takes: an action or a kind of target this
 * web does not know, an ISU that is not a number or a date that is not a day would be a 400, so the
 * page ignores them. Dates given in the wrong order are swapped rather than refused.
 */
export function filtersOf(query: Record<keyof AuditFilters, string>): AuditFilters {
  const actorIsu = /^\d{1,9}$/.test(query.actorIsu) ? query.actorIsu : '';
  const action = isKnownAction(query.action) ? query.action : '';
  const targetType = TYPES.has(query.targetType) ? query.targetType : '';
  const target = query.target.trim();
  let from = isDay(query.from) ? query.from : '';
  let to = isDay(query.to) ? query.to : '';
  if (from && to && from > to) [from, to] = [to, from];
  return { actorIsu, action, targetType, target, from, to };
}

export function hasFilters(filters: AuditFilters): boolean {
  return Object.values(filters).some(Boolean);
}
