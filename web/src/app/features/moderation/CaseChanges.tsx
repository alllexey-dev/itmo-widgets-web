import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Token } from '@astryxdesign/core/Token';
import { VisuallyHidden } from '@astryxdesign/core/VisuallyHidden';
import { Sparkles } from 'lucide-react';
import { hasApprovedVersion } from './decisions';
import { CATEGORIES, visibilityLabel } from './labels';
import { Section } from './Section';
import type { CaseTarget, SubjectLinkTarget } from './types';
import { wordDiff } from './wordDiff';

interface DiffRow extends Record<string, unknown> {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

const CAPTION = 'Изменения относительно одобренной версии';

function linkRows({ revision, link }: SubjectLinkTarget): DiffRow[] {
  const audience = revision.flowId === link.flowId ? link.audienceLabel : null;
  return [
    {
      key: 'category',
      label: 'Категория',
      before: CATEGORIES[link.category].label,
      after: CATEGORIES[revision.category].label,
      changed: link.category !== revision.category,
    },
    {
      key: 'title',
      label: 'Название',
      before: link.title ?? '—',
      after: revision.title ?? '—',
      changed: (link.title ?? '') !== (revision.title ?? ''),
    },
    {
      key: 'url',
      label: 'Адрес',
      before: link.url,
      after: revision.url,
      changed: link.url !== revision.url,
    },
    {
      key: 'visibility',
      label: 'Кто видит',
      before: visibilityLabel(link.visibility, link.audienceLabel),
      after: visibilityLabel(revision.visibility, audience),
      changed: link.visibility !== revision.visibility || link.flowId !== revision.flowId,
    },
  ];
}

/** Two versions side by side; a changed row says so in words, not only in colour. */
function DiffTable({ rows, afterLabel }: { rows: DiffRow[]; afterLabel: string }) {
  const columns: TableColumn<DiffRow>[] = [
    {
      key: 'label',
      header: <VisuallyHidden>Поле</VisuallyHidden>,
      // The widths keep the ratio of their minimums, so on a phone, where the three columns share
      // 343 px, each gets exactly what it needs: this one the "изменено" mark.
      width: proportional(0.95, { minWidth: 114 }),
      renderCell: (row) => (
        <span className="mod-diff-field">
          {row.label}
          {row.changed ? <Token label="изменено" color="orange" size="sm" /> : null}
        </span>
      ),
    },
    {
      key: 'before',
      header: 'Одобрено',
      width: proportional(0.8, { minWidth: 96 }),
      renderCell: (row) => (
        <span className="mod-diff-value" data-side={row.changed ? 'before' : undefined}>
          {row.before}
        </span>
      ),
    },
    {
      key: 'after',
      header: afterLabel,
      // The longer of its two headers, "На проверке", fits at this width.
      width: proportional(1.1, { minWidth: 132 }),
      renderCell: (row) => (
        <span className="mod-diff-value" data-side={row.changed ? 'after' : undefined}>
          {row.after}
        </span>
      ),
    },
  ];
  return (
    <div className="mod-diff">
      <Table<DiffRow>
        data={rows}
        columns={columns}
        idKey="key"
        density="compact"
        verticalAlign="top"
        aria-label={CAPTION}
      />
    </div>
  );
}

/** One text with deleted words struck through and added ones highlighted; screen readers hear which is which. */
function TextDiff({ before, after }: { before: string; after: string }) {
  return (
    <p className="mod-textdiff">
      {wordDiff(before, after).map((part, index) => {
        if (part.kind === 'removed') {
          return (
            <del key={index}>
              <VisuallyHidden>удалено: </VisuallyHidden>
              {part.text}
            </del>
          );
        }
        if (part.kind === 'added') {
          return (
            <ins key={index}>
              <VisuallyHidden>добавлено: </VisuallyHidden>
              {part.text}
            </ins>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </p>
  );
}

function NewNote({ text }: { text: string }) {
  return (
    <p className="mod-note">
      <Sparkles size={16} aria-hidden />
      {text}
    </p>
  );
}

/**
 * What the case would change against what others see now. For a link, `link` is the approved version
 * while an edit waits, or the revision itself before the first approval; for a review, `review.shown`
 * is the approved revision and is missing until one was approved.
 */
export function CaseChanges({ target }: { target: CaseTarget }) {
  const afterLabel = target.revision.status === 'PENDING' ? 'На проверке' : 'В заявке';
  // Nothing to compare with: the first version still waits for its review.
  const isNew = target.revision.status === 'PENDING' && !hasApprovedVersion(target);

  if (target.targetType === 'SUBJECT_RESOURCE') {
    if (isNew) return <NewNote text="Новая ссылка, одобренных версий ещё нет" />;
    const rows = linkRows(target);
    return rows.some((row) => row.changed) ? (
      <Section title="Изменения">
        <DiffTable rows={rows} afterLabel={afterLabel} />
      </Section>
    ) : null;
  }

  if (isNew) return <NewNote text="Новый отзыв, одобренных версий ещё нет" />;
  const shown = target.review.shown;
  if (!shown) return null;
  const subjectChanged = (shown.subjectTitle ?? '') !== (target.revision.subjectTitle ?? '');
  const textChanged = shown.text !== target.revision.text;
  if (!subjectChanged && !textChanged) return null;
  return (
    <Section title="Изменения">
      <DiffTable
        rows={[
          {
            key: 'subject',
            label: 'Предмет',
            before: shown.subjectTitle ?? '—',
            after: target.revision.subjectTitle ?? '—',
            changed: subjectChanged,
          },
        ]}
        afterLabel={afterLabel}
      />
      <div className="mod-textdiff-head">
        <span className="mod-textdiff-title">Текст</span>
        {textChanged ? (
          <Token label="изменено" color="orange" size="sm" />
        ) : (
          <span className="mod-muted">не изменён</span>
        )}
      </div>
      {textChanged ? <TextDiff before={shown.text} after={target.revision.text} /> : null}
    </Section>
  );
}
