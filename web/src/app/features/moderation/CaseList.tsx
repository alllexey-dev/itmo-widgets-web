import { Item } from '@astryxdesign/core/Item';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import {
  Flag,
  Gavel,
  MessageSquareOff,
  MessageSquareText,
  Unlink,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatDateTime, formatRelative, plural } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import {
  ACTIONS,
  CASE_STATUSES,
  CATEGORIES,
  hostOf,
  OUTCOME_COLORS,
  REASONS,
  TARGET_TEXTS,
} from './labels';
import type { AdminCaseItem, AdminCaseOutcome } from './types';

interface Props {
  items: AdminCaseItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface RowTexts {
  icon: LucideIcon;
  title: string;
  line: string;
  hidden: string | null;
}

function linkRow(item: AdminCaseItem): RowTexts {
  const { revision, link } = item;
  if (!revision) return { icon: Unlink, title: 'Ссылка удалена', line: 'Нет данных', hidden: null };
  return {
    icon: CATEGORIES[revision.category].icon,
    // The same words as the case: its preview calls an untitled link this too.
    title: revision.title?.trim() || 'Без названия',
    line: [link?.subjectName, hostOf(revision.url)].filter(Boolean).join(' · ') || 'Нет данных',
    hidden: link?.hidden ? 'скрыта' : null,
  };
}

function reviewRow(item: AdminCaseItem): RowTexts {
  const review = item.review;
  if (!review) {
    return { icon: MessageSquareOff, title: 'Отзыв удалён', line: 'Нет данных', hidden: null };
  }
  return {
    icon: MessageSquareText,
    // The case names the teacher the same way. Backend looks up only a few names per page, so a
    // review further down may wait for a later load with its ISU.
    title: `Отзыв · ${review.teacherName ?? `ИСУ ${review.teacherIsu}`}`,
    line: [review.subjectTitle, review.excerpt].filter(Boolean).join(' · '),
    hidden: review.hidden ? 'скрыт' : null,
  };
}

/**
 * What became of a closed case: hidden, or the fate of the revision, in the words of the case
 * header. Only a deleted target leaves the row without a state: then it says that the case is
 * closed and how, resolved by a moderator or closed without a decision of its own.
 */
function outcomeOf(item: AdminCaseItem): { label: string; color: TokenColor } | null {
  if (item.status === 'OPEN') return null;
  const texts = TARGET_TEXTS[item.targetType];
  if (item.link?.hidden || item.review?.hidden) return { label: texts.hidden, color: 'orange' };
  const status = item.revision?.status ?? item.review?.revisionStatus;
  if (status && status !== 'PENDING') {
    return { label: texts.outcomes[status], color: OUTCOME_COLORS[status] };
  }
  return item.status === 'WITHDRAWN'
    ? { label: 'Без решения', color: 'gray' }
    : { label: CASE_STATUSES.RESOLVED.label, color: 'gray' };
}

const REPORT_FORMS = ['жалоба', 'жалобы', 'жалоб'] as const;

/** Who took the decision that resolved the case. */
function deciderOf(outcome: AdminCaseOutcome): string {
  if (outcome.actor === 'POLICY') return 'автоматически';
  return (
    outcome.moderatorName ?? (outcome.moderatorIsu ? `ИСУ ${outcome.moderatorIsu}` : 'модератор')
  );
}

/** The decision of a resolved case: who took it, and in the tooltip what it was and its note. */
function Outcome({ outcome }: { outcome: AdminCaseOutcome }) {
  const label = ACTIONS[outcome.action].label;
  const who = deciderOf(outcome);
  const details = [label, formatDateTime(outcome.decidedAt), outcome.note].filter(Boolean);
  return (
    <span className="mod-row-outcome" title={details.join(' · ')}>
      <Gavel size={12} aria-hidden />
      <span className="mod-row-outcome-name">
        <VisuallyHidden>{label}: </VisuallyHidden>
        {who}
      </span>
    </span>
  );
}

/** The queue: one row per case with what it is about, who sent it, when and why it is here. */
export function CaseList({ items, selectedId, onSelect }: Props) {
  const list = useRef<HTMLUListElement>(null);
  // J and K move the selection; keep it on screen.
  useEffect(() => {
    if (!selectedId) return;
    list.current
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  return (
    <ul ref={list} className="mod-list" aria-label="Заявки">
      {items.map((item) => {
        const row = item.targetType === 'TEACHER_REVIEW' ? reviewRow(item) : linkRow(item);
        const reason = REASONS[item.reason];
        const closed = item.status !== 'OPEN';
        const time = closed ? (item.resolvedAt ?? item.openedAt) : item.openedAt;
        // A closed case says how it ended. Among open ones a new submission is the usual case;
        // only what stands out gets a mark.
        const mark =
          outcomeOf(item) ??
          (item.reason === 'SUBMISSION' ? null : { label: reason.mark, color: reason.color });
        const selected = item.id === selectedId;
        return (
          <Item
            key={item.id}
            as="li"
            align="start"
            isSelected={selected}
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
            startContent={<IconTile icon={row.icon} />}
            // The mark shares the title's line, so the lines under it have the row's full width.
            label={
              <span className="mod-row-head">
                <span className="mod-row-title">{row.title}</span>
                {mark ? <Token label={mark.label} color={mark.color} size="sm" /> : null}
              </span>
            }
            description={
              <span className="mod-row">
                <span className="mod-row-line">{row.line}</span>
                <span className="mod-row-meta">
                  {item.author ? <span className="mod-row-author">{item.author.name}</span> : null}
                  <span title={formatDateTime(time)}>{formatRelative(time)}</span>
                  {item.outcome ? <Outcome outcome={item.outcome} /> : null}
                  {!closed && row.hidden ? (
                    <span className="mod-row-hidden">{row.hidden}</span>
                  ) : null}
                  {item.reportCount > 0 ? (
                    <span className="mod-row-reports">
                      <Flag size={12} aria-hidden />
                      {item.reportCount}
                      <VisuallyHidden> {plural(item.reportCount, REPORT_FORMS)}</VisuallyHidden>
                    </span>
                  ) : null}
                </span>
              </span>
            }
          />
        );
      })}
    </ul>
  );
}
