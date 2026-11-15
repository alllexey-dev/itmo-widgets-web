import { Item } from '@astryxdesign/core/Item';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import { Flag, MessageSquareOff, MessageSquareText, Unlink, type LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatDateTime, formatRelative, plural } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { CASE_STATUSES, CATEGORIES, hostOf, OUTCOME_COLORS, REASONS, TARGET_TEXTS } from './labels';
import type { AdminCaseItem } from './types';

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
    // The queue knows the teacher only by ISU; the name comes with the case.
    title: `Отзыв · ИСУ ${review.teacherIsu}`,
    line: [review.subjectTitle, review.excerpt].filter(Boolean).join(' · '),
    hidden: review.hidden ? 'скрыт' : null,
  };
}

/**
 * What became of a closed case, as far as its row knows: hidden, or the fate of a link's revision.
 * A review's row carries no decision, so it says only that the case is closed and how: resolved by
 * a moderator, or closed without a decision of its own.
 */
function outcomeOf(item: AdminCaseItem): { label: string; color: TokenColor } | null {
  if (item.status === 'OPEN') return null;
  const texts = TARGET_TEXTS[item.targetType];
  if (item.link?.hidden || item.review?.hidden) return { label: texts.hidden, color: 'orange' };
  const status = item.revision?.status;
  if (status && status !== 'PENDING') {
    return { label: texts.outcomes[status], color: OUTCOME_COLORS[status] };
  }
  return item.status === 'WITHDRAWN'
    ? { label: 'Без решения', color: 'gray' }
    : { label: CASE_STATUSES.RESOLVED.label, color: 'gray' };
}

const REPORT_FORMS = ['жалоба', 'жалобы', 'жалоб'] as const;

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
