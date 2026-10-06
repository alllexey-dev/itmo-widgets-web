import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { DEFAULT_PAGE_SIZE } from '../../api/admin';
import { errorText } from '../../api/errors';
import {
  Badge,
  Card,
  CardHeader,
  ErrorState,
  formatDateTime,
  formatNumber,
  LoadingOverlay,
  Pagination,
  Table,
  Tabs,
  type TableColumn,
} from '../../ui';
import { useSummaryTeachers } from './api';
import { SUMMARY_LEVELS, SUMMARY_STATUSES, teacherLabel } from './labels';
import styles from './ReviewsPage.module.css';
import { SummaryDialog } from './SummaryDialog';
import type { AdminSummaryStatus, TeacherSummaryRow } from './types';

type Filter = AdminSummaryStatus | 'ALL';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Все' },
  { value: 'READY', label: 'Готовы' },
  { value: 'PENDING', label: 'В очереди' },
  { value: 'FAILED', label: 'Ошибки' },
  { value: 'HIDDEN', label: 'Скрыты' },
];

function filterOf(value: string | null): Filter {
  return FILTERS.find((filter) => filter.value === value)?.value ?? 'ALL';
}

function Missing() {
  return <span className="m3-muted">—</span>;
}

const COLUMNS: TableColumn<TeacherSummaryRow>[] = [
  { key: 'teacher', header: 'Преподаватель', minWidth: 200, render: teacherLabel },
  {
    key: 'status',
    header: 'Статус',
    render: (row) => {
      const status = SUMMARY_STATUSES[row.status];
      return <Badge tone={status.tone}>{status.label}</Badge>;
    },
  },
  {
    key: 'reviews',
    header: 'Отзывов',
    align: 'end',
    render: (row) => formatNumber(row.inputCount),
  },
  {
    key: 'level',
    header: 'Тон',
    render: (row) => (row.summary ? SUMMARY_LEVELS[row.summary.level] : <Missing />),
  },
  {
    key: 'generated',
    header: 'Построена',
    render: (row) =>
      row.summary ? (
        <span className={styles.nowrap}>{formatDateTime(row.summary.generatedAt)}</span>
      ) : (
        <Missing />
      ),
  },
  {
    key: 'error',
    header: 'Ошибка',
    render: (row) =>
      row.lastError ? <code className={styles.error}>{row.lastError}</code> : <Missing />,
  },
];

export function SummariesTable() {
  const [params, setParams] = useSearchParams();
  const filter = filterOf(params.get('status'));
  const page = Math.max(0, Number(params.get('page')) || 0);
  const teachers = useSummaryTeachers(filter === 'ALL' ? null : filter, page);
  const [open, setOpen] = useState<TeacherSummaryRow | null>(null);

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        Object.entries(changes).forEach(([key, value]) =>
          value === null ? next.delete(key) : next.set(key, value),
        );
        return next;
      },
      { replace: true },
    );

  return (
    <Card as="section" aria-label="Сводки преподавателей">
      <CardHeader title="Сводки преподавателей" />
      <Tabs<Filter>
        label="Статус сводки"
        tabs={FILTERS}
        value={filter}
        onChange={(next) => update({ status: next === 'ALL' ? null : next, page: null })}
        className={styles.filters}
      />
      {teachers.isError ? (
        <ErrorState
          compact
          title="Не удалось загрузить таблицу сводок"
          description={errorText(teachers.error, 'Попробуйте ещё раз.')}
          onRetry={() => void teachers.refetch()}
          retrying={teachers.isFetching}
        />
      ) : teachers.isPending ? (
        <Table
          caption="Сводки преподавателей"
          columns={COLUMNS}
          rows={[]}
          rowKey={(row) => String(row.teacherIsu)}
          loading
          bleed
        />
      ) : (
        <LoadingOverlay loading={teachers.isPlaceholderData}>
          <Table
            caption="Сводки преподавателей"
            columns={COLUMNS}
            rows={teachers.data.items}
            rowKey={(row) => String(row.teacherIsu)}
            onRowClick={setOpen}
            bleed
            empty={{ icon: 'auto_awesome', title: 'Сводок пока нет' }}
          />
          <Pagination
            page={page}
            size={DEFAULT_PAGE_SIZE}
            total={teachers.data.total}
            onChange={(next) => update({ page: next > 0 ? String(next) : null })}
          />
        </LoadingOverlay>
      )}
      {open && <SummaryDialog row={open} onClose={() => setOpen(null)} />}
    </Card>
  );
}
