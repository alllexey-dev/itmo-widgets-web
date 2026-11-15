import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { History } from 'lucide-react';
import { useApiQuery } from '../../lib/data';
import { formatDateTime } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { Mono } from '../../lib/Mono';
import { PageHeader } from '../../lib/PageHeader';
import { Pagination } from '../../lib/Pagination';
import { useQueryState } from '../../lib/router';
import './audit.css';
import { actionOf, detailsOf, nameOrFallback, targetOf } from './labels';
import type { AuditEntry, AuditPage as AuditPageData, TargetUser } from './types';

const AUDIT_PATH = '/api/admin/audit';
const USERS_PATH = '/api/admin/users';
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
 * A user the entry is about. The entry carries only the ISU, so the name comes from the user's
 * card: the same cached answer the card itself shows. Until it arrives, and for a user Backend no
 * longer has, the ISU alone is the link.
 */
function UserTarget({ isu, isSmall }: { isu: number; isSmall?: boolean }) {
  const card = useApiQuery<TargetUser>(`${USERS_PATH}/${isu}`);
  const type = isSmall ? 'supporting' : 'body';
  const href = `/admin/users/${isu}`;
  if (!card.data) {
    return (
      <Link href={href} type={type} hasUnderline>
        ИСУ {isu}
      </Link>
    );
  }
  const name = (
    <Link href={href} type={type} hasUnderline>
      {nameOrFallback(card.data.user.name)}
    </Link>
  );
  return isSmall ? (
    <>
      {name} · ИСУ {isu}
    </>
  ) : (
    <VStack gap={0}>
      {name}
      <Text type="supporting" color="secondary" hasTabularNumbers>
        ИСУ {isu}
      </Text>
    </VStack>
  );
}

function Target({ entry, isSmall }: CellProps) {
  const target = targetOf(entry.target);
  if (target.kind === 'user') return <UserTarget isu={target.isu} isSmall={isSmall} />;
  if (target.kind === 'raw') return <Mono>{target.text}</Mono>;
  return (
    <Link href={target.href} type={isSmall ? 'supporting' : 'body'} hasUnderline>
      {target.text}
    </Link>
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

/** `/admin/audit`: who changed or started what, newest first. */
export default function AuditPage() {
  const [query, setQuery] = useQueryState({ page: 0 });
  const page = Math.max(0, Math.trunc(query.page));
  const isNarrow = useMediaQuery(NARROW);
  const audit = useApiQuery<AuditPageData>(AUDIT_PATH, { page, size: PAGE_SIZE });

  return (
    <VStack gap={6}>
      <PageHeader
        title="Журнал"
        text="Кто и когда менял роли и доступы, правила модерации, версию приложения и учётные данные или запускал синхронизацию и ИИ-сводки"
      />
      <Card padding={0}>
        <Loadable
          resource={audit}
          label="Загружаем журнал"
          errorTitle="Не удалось загрузить журнал"
        >
          {(list) => (
            <>
              {list.items.length === 0 ? (
                <EmptyState
                  icon={<History size={32} />}
                  title="Записей пока нет"
                  description="Здесь появятся изменения, которые делают администраторы"
                />
              ) : isNarrow ? (
                <AuditList entries={list.items} />
              ) : (
                <AuditTable entries={list.items} />
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
  );
}
