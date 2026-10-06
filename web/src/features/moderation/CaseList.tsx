import type { IconName } from '../../ui/icons';
import { useEffect, useRef } from 'react';
import { Badge, cx, Icon, LoadingIndicator, formatRelative } from '../../ui';
import { CATEGORIES, hostOf, REASONS } from './labels';
import styles from './CaseList.module.css';
import type { AdminCaseItem } from './types';

export interface CaseListProps {
  items: readonly AdminCaseItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface RowTexts {
  icon: IconName;
  title: string;
  line: string;
  hidden: string | null;
}

function linkRow(item: AdminCaseItem): RowTexts {
  const { revision, link } = item;
  if (!revision) {
    return { icon: 'link_off', title: 'Ссылка удалена', line: 'Нет данных', hidden: null };
  }
  const host = hostOf(revision.url);
  return {
    icon: CATEGORIES[revision.category].icon,
    title: revision.title?.trim() || host || revision.url,
    line: [link?.subjectName, host].filter(Boolean).join(' · ') || 'Нет данных',
    hidden: link?.hidden ? 'скрыта' : null,
  };
}

function reviewRow(item: AdminCaseItem): RowTexts {
  const review = item.review;
  if (!review) {
    return { icon: 'comments_disabled', title: 'Отзыв удалён', line: 'Нет данных', hidden: null };
  }
  return {
    icon: 'rate_review',
    title: [`ИСУ ${review.teacherIsu}`, review.subjectTitle].filter(Boolean).join(' · '),
    line: review.excerpt,
    hidden: review.hidden ? 'скрыт' : null,
  };
}

export function CaseList({ items, selectedId, onSelect }: CaseListProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!selectedId) return;
    const selected = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    selected?.scrollIntoView?.({ block: 'nearest' });
  }, [selectedId]);

  return (
    <ul ref={listRef} className={styles.list} aria-label="Заявки">
      {items.map((item) => (
        <li key={item.id}>
          <CaseRow
            item={item}
            selected={item.id === selectedId}
            onSelect={() => onSelect(item.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function CaseRow({
  item,
  selected,
  onSelect,
}: {
  item: AdminCaseItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const row = item.targetType === 'TEACHER_REVIEW' ? reviewRow(item) : linkRow(item);
  const reason = REASONS[item.reason];
  const time = item.status === 'OPEN' ? item.openedAt : (item.resolvedAt ?? item.openedAt);
  return (
    <button
      type="button"
      className={cx(styles.row, selected && styles.selected)}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
    >
      <span className={styles.icon}>
        <Icon name={row.icon} size={20} />
      </span>
      <span className={styles.body}>
        <span className={styles.top}>
          <span className={styles.title}>{row.title}</span>
          <Badge tone={reason.tone} className={styles.reason}>
            {reason.label}
          </Badge>
        </span>
        <span className={styles.line}>{row.line}</span>
        <span className={styles.meta}>
          {item.author && <span className={styles.author}>{item.author.name}</span>}
          <span>{formatRelative(time)}</span>
          {item.reportCount > 0 && (
            <span className={styles.reports}>
              <Icon name="flag" size={18} />
              {item.reportCount}
              <span className="visually-hidden"> жалоб</span>
            </span>
          )}
          {row.hidden && <span className={styles.hidden}>{row.hidden}</span>}
        </span>
      </span>
    </button>
  );
}

export function CaseListLoading() {
  return <LoadingIndicator label="Загружаем заявки" />;
}
