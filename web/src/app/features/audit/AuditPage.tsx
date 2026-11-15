import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { History, SearchX } from 'lucide-react';
import { useApiQuery } from '../../lib/data';
import { formatDateTime } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { Mono } from '../../lib/Mono';
import { PageHeader } from '../../lib/PageHeader';
import { Pagination } from '../../lib/Pagination';
import { useQueryState } from '../../lib/router';
import './audit.css';
import { AuditFilterBar } from './AuditFilterBar';
import { AUDIT_QUERY, filtersOf, hasFilters, NO_FILTERS, type AuditFilters } from './filters';
import { actionOf, detailsOf, nameOrFallback, personLine, targetOf } from './labels';
import type { AuditEntry, AuditPage as AuditPageData } from './types';

const AUDIT_PATH = '/api/admin/audit';
const PAGE_SIZE = 20;

/**
 * Below this width the five columns no longer fit beside the navigation, and the table gives way to
 * rows that stack an entry's fields.
 */
const NARROW = '(max-width: 900px)';

interface CellProps {
  entry: AuditEntry;
  /** The supporting type of a stacked row instead of the body type of a table cell. */
  isSmall?: boolean;
}

function Actor({ entry, isSmall }: CellProps) {
  return (
    <Link
      href={`/admin/users/${entry.actorIsu}`}
      type={isSmall ? 'supporting' : 'body'}
      hasUnderline
    >
      {nameOrFallback(entry.actorName)}
    </Link>
  );
}

function Action({ entry }: { entry: AuditEntry }) {
  const action = actionOf(entry.action);
  const { platform } = detailsOf(entry);
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      {action.isKnown ? <span>{action.label}</span> : <Mono>{action.label}</Mono>}
      {platform ? <Token size="sm" label={platform} /> : null}
    </HStack>
  );
}

/**
 * A user or a teacher the entry is about, by the name Backend stored with the entry. A user that is
 * gone or has no name, and a teacher nobody has a name for, is the ISU alone.
 */
function Target({ entry, isSmall }: CellProps) {
  const target = targetOf(entry.target, entry.targetName);
  const type = isSmall ? 'supporting' : 'body';
  if (target.kind === 'raw') return <Mono>{target.text}</Mono>;
  if (target.kind === 'place') {
    return (
      <Link href={target.href} type={type} hasUnderline>
        {target.text}
      </Link>
    );
  }
  if (target.name === null) {
    return (
      <Link href={target.href} type={type} hasUnderline>
        {personLine(target)}
      </Link>
    );
  }
  const name = (
    <Link href={target.href} type={type} hasUnderline>
      {target.name}
    </Link>
  );
  return isSmall ? (
    <>
      {name} · {personLine(target)}
    </>
  ) : (
    <VStack gap={0}>
      {name}
      <Text type="supporting" color="secondary" hasTabularNumbers>
        {personLine(target)}
      </Text>
    </VStack>
  );
}

function Details({ entry }: { entry: AuditEntry }) {
  const { lines } = detailsOf(entry);
  return (
    <VStack gap={0.5}>
      {lines.map((line, index) =>
        line.isRaw ? (
          <Mono key={`${index}-${line.text}`}>{line.text}</Mono>
        ) : (
          <span key={`${index}-${line.text}`} className="audit-detail">
            {line.text}
          </span>
        ),
      )}
    </VStack>
  );
}

function ActionIcon({ entry }: { entry: AuditEntry }) {
  return <IconTile icon={actionOf(entry.action).icon} />;
}

const COLUMNS: TableColumn<AuditEntry>[] = [
  {
    key: 'createdAt',
    header: 'Когда',
    width: pixel(144),
    renderCell: (entry) => (
      <Text color="secondary" hasTabularNumbers>
        {formatDateTime(entry.createdAt)}
      </Text>
    ),
  },
  {
    key: 'actor',
    header: 'Кто',
    width: proportional(1, { minWidth: 125 }),
    renderCell: (entry) => (
      <VStack gap={0}>
        <Actor entry={entry} />
        <Text type="supporting" color="secondary" hasTabularNumbers>
          ИСУ {entry.actorIsu}
        </Text>
      </VStack>
    ),
  },
  {
    key: 'action',
    header: 'Действие',
    width: proportional(2, { minWidth: 230 }),
    renderCell: (entry) => (
      <HStack gap={3} vAlign="center">
        <ActionIcon entry={entry} />
        <Action entry={entry} />
      </HStack>
    ),
  },
  {
    key: 'target',
    header: 'Объект',
    width: proportional(1.5, { minWidth: 170 }),
    renderCell: (entry) => <Target entry={entry} />,
  },
  {
    key: 'details',
    header: 'Подробности',
    width: proportional(1.5, { minWidth: 185 }),
    renderCell: (entry) =>
      entry.details ? <Details entry={entry} /> : <Text color="secondary">—</Text>,
  },
];

function AuditTable({ entries }: { entries: AuditEntry[] }) {
  return <Table<AuditEntry> aria-label="Журнал" data={entries} columns={COLUMNS} idKey="id" />;
}

function AuditList({ entries }: { entries: AuditEntry[] }) {
  return (
    <List aria-label="Журнал" hasDividers>
      {entries.map((entry) => (
        <ListItem
          key={entry.id}
          align="start"
          startContent={<ActionIcon entry={entry} />}
          label={<Action entry={entry} />}
          description={
            <VStack gap={1}>
              <Text type="supporting" color="secondary">
                <Target entry={entry} isSmall />
              </Text>
              {entry.details ? <Details entry={entry} /> : null}
              <Text type="supporting" color="secondary" hasTabularNumbers>
                <Actor entry={entry} isSmall /> · {formatDateTime(entry.createdAt)}
              </Text>
            </VStack>
          }
        />
      ))}
    </List>
  );
}

/** `/admin/audit`: who changed or started what, newest first, narrowed by who, what and when. */
export default function AuditPage() {
  const [query, setQuery] = useQueryState(AUDIT_QUERY);
  const page = Math.max(0, Math.trunc(query.page));
  const filters = filtersOf(query);
  const isFiltered = hasFilters(filters);
  const isNarrow = useMediaQuery(NARROW);
  const audit = useApiQuery<AuditPageData>(AUDIT_PATH, { ...filters, page, size: PAGE_SIZE });

  // Another filter is another list: it starts from its first page.
  const change = (patch: Partial<Record<keyof AuditFilters, string | null>>) =>
    setQuery({ ...patch, page: null });
  const clear = () => setQuery({ ...NO_FILTERS, page: null });

  return (
    <VStack gap={6}>
      <PageHeader
        title="Журнал"
        text="Кто и когда менял роли и доступы, правила модерации, версию приложения и учётные данные или запускал синхронизацию и ИИ-сводки"
      />
      <VStack gap={3}>
        <AuditFilterBar
          filters={filters}
          entries={audit.data?.items ?? []}
          total={audit.data?.total}
          onChange={change}
          onClear={clear}
        />
        <Card padding={0}>
          <Loadable
            resource={audit}
            label="Загружаем журнал"
            errorTitle="Не удалось загрузить журнал"
          >
            {(list) => (
              <>
                {list.items.length > 0 ? (
                  isNarrow ? (
                    <AuditList entries={list.items} />
                  ) : (
                    <AuditTable entries={list.items} />
                  )
                ) : isFiltered ? (
                  <EmptyState
                    icon={<SearchX size={32} />}
                    title="Ничего не нашлось"
                    description="Ни одна запись не подходит под выбранные условия"
                    actions={
                      <Button label="Сбросить фильтры" variant="secondary" onClick={clear} />
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<History size={32} />}
                    title="Записей пока нет"
                    description="Здесь появятся изменения, которые делают администраторы"
                  />
                )}
                <Pagination
                  page={page}
                  size={PAGE_SIZE}
                  total={list.total}
                  onChange={(next) => setQuery({ page: next })}
                />
              </>
            )}
          </Loadable>
        </Card>
      </VStack>
    </VStack>
  );
}
