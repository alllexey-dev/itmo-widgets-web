import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Inbox } from 'lucide-react';
import { useId, useState } from 'react';
import { useApiQuery } from '../../lib/data';
import { counted, formatDateTime, formatNumber } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { Pagination } from '../../lib/Pagination';
import { Panel } from '../../lib/Panel';
import { useQueryState } from '../../lib/router';
import { Mono } from '../../lib/Mono';
import { PAGE_SIZE, TEACHERS_PATH } from './api';
import { SUMMARY_FILTERS, SUMMARY_LEVELS, SUMMARY_STATUSES, teacherName } from './labels';
import { SummaryDialog } from './SummaryDialog';
import type { TeacherPage, TeacherSummaryRow } from './types';

type Row = TeacherSummaryRow & Record<string, unknown>;

function columns(onOpen: (row: TeacherSummaryRow) => void): TableColumn<Row>[] {
  return [
    {
      key: 'teacher',
      header: 'Преподаватель',
      width: proportional(2, { minWidth: 220 }),
      renderCell: (row) => (
        <span className="reviews-cell">
          <Link onClick={() => onOpen(row)} weight="medium" maxLines={1} hasUnderline>
            {teacherName(row)}
          </Link>
          {row.teacherName ? (
            <Text type="supporting" color="secondary" hasTabularNumbers>
              ИСУ {row.teacherIsu}
            </Text>
          ) : null}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      width: pixel(124),
      renderCell: (row) => {
        const status = SUMMARY_STATUSES[row.status];
        return <Token size="sm" color={status.color} label={status.label} />;
      },
    },
    {
      key: 'inputCount',
      header: 'Отзывов',
      width: pixel(96),
      align: 'end',
      renderCell: (row) => (
        <Text type="body" hasTabularNumbers>
          {formatNumber(row.inputCount)}
        </Text>
      ),
    },
    {
      key: 'level',
      header: 'Тон',
      width: proportional(2, { minWidth: 230 }),
      renderCell: (row) => (row.summary ? SUMMARY_LEVELS[row.summary.level] : '—'),
    },
    {
      key: 'generatedAt',
      header: 'Построена',
      width: pixel(150),
      renderCell: (row) => (
        <Text type="body" color="secondary" hasTabularNumbers>
          {row.summary ? formatDateTime(row.summary.generatedAt) : '—'}
        </Text>
      ),
    },
    {
      key: 'lastError',
      header: 'Ошибка',
      width: proportional(1.2, { minWidth: 130 }),
      renderCell: (row) => (row.lastError ? <Mono tone="error">{row.lastError}</Mono> : '—'),
    },
  ];
}

/**
 * Below this width the six columns no longer fit beside the navigation, and the table gives way to
 * rows that stack a teacher's fields.
 */
const NARROW = '(max-width: 1100px)';

/** The teachers as stacked rows: everything a table row says; the name opens the summary. */
function TeachersList({
  rows,
  onOpen,
}: {
  rows: TeacherSummaryRow[];
  onOpen: (row: TeacherSummaryRow) => void;
}) {
  return (
    <List aria-label="Сводки преподавателей" hasDividers>
      {rows.map((row) => {
        const status = SUMMARY_STATUSES[row.status];
        return (
          <ListItem
            key={row.teacherIsu}
            align="start"
            label={
              <HStack gap={2} vAlign="center" wrap="wrap">
                <Link onClick={() => onOpen(row)} weight="medium" hasUnderline>
                  {teacherName(row)}
                </Link>
                <Token size="sm" color={status.color} label={status.label} />
              </HStack>
            }
            description={
              <VStack gap={1}>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {[
                    row.teacherName ? `ИСУ ${row.teacherIsu}` : null,
                    counted(row.inputCount, ['отзыв', 'отзыва', 'отзывов']),
                    row.summary ? `построена ${formatDateTime(row.summary.generatedAt)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {row.summary ? <Text type="body">{SUMMARY_LEVELS[row.summary.level]}</Text> : null}
                {row.lastError ? <Mono tone="error">{row.lastError}</Mono> : null}
              </VStack>
            }
          />
        );
      })}
    </List>
  );
}

interface Props {
  /** Summaries are on at the server. */
  isEnabled: boolean;
}

/** Teachers with a summary status; `status` and `page` live in the address. A name opens the summary. */
export function SummariesTable({ isEnabled }: Props) {
  const [query, setQuery] = useQueryState({ status: '', page: 0 });
  const filter = SUMMARY_FILTERS.find((item) => item.value === query.status) ?? SUMMARY_FILTERS[0];
  const page = Math.max(0, Math.floor(query.page));
  const teachers = useApiQuery<TeacherPage>(TEACHERS_PATH, {
    status: filter?.value,
    page,
    size: PAGE_SIZE,
  });
  const [opened, setOpened] = useState<TeacherSummaryRow | null>(null);
  const panelId = useId();
  const isNarrow = useMediaQuery(NARROW);

  return (
    <>
      <Panel title="Сводки преподавателей">
        <TabList
          role="tablist"
          aria-label="Статус сводки"
          className="reviews-tabs"
          size="sm"
          value={filter?.value ?? ''}
          onChange={(status) => setQuery({ status, page: null })}
          hasDivider
          overflow="scroll"
        >
          {SUMMARY_FILTERS.map((item) => (
            <Tab key={item.value} value={item.value} label={item.label} panelId={panelId} />
          ))}
        </TabList>
        <div id={panelId} role="tabpanel" aria-label={filter?.label}>
          <Loadable
            resource={teachers}
            label="Загружаем сводки преподавателей"
            errorTitle="Не удалось загрузить сводки преподавателей"
            isCompact
          >
            {(list) => (
              <>
                {list.items.length === 0 ? (
                  <EmptyState
                    icon={<Inbox size={32} />}
                    title="Сводок пока нет"
                    description={
                      filter?.value
                        ? 'С таким статусом нет ни одного преподавателя'
                        : 'Сводки появятся после первого пересчёта'
                    }
                    headingLevel={3}
                    isCompact
                  />
                ) : isNarrow ? (
                  <TeachersList rows={list.items} onOpen={setOpened} />
                ) : (
                  <Table<Row>
                    aria-label="Сводки преподавателей"
                    className="reviews-teachers"
                    data={list.items as Row[]}
                    columns={columns(setOpened)}
                    idKey="teacherIsu"
                    density="compact"
                    dividers="rows"
                    textOverflow="truncate"
                    hasHover
                  />
                )}
                <Pagination
                  page={list.page}
                  size={list.size}
                  total={list.total}
                  onChange={(next) => setQuery({ page: next })}
                />
              </>
            )}
          </Loadable>
        </div>
      </Panel>
      {opened ? (
        <SummaryDialog
          key={opened.teacherIsu}
          row={opened}
          isEnabled={isEnabled}
          onClose={() => setOpened(null)}
        />
      ) : null}
    </>
  );
}
