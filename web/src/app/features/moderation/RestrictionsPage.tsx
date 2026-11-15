import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { IconButton } from '@astryxdesign/core/IconButton';
import { List, ListItem } from '@astryxdesign/core/List';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token } from '@astryxdesign/core/Token';
import { Gavel, Search, SearchX, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { formatDate } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { PageHeader } from '../../lib/PageHeader';
import { Pagination } from '../../lib/Pagination';
import { useQueryState } from '../../lib/router';
import {
  RESTRICTIONS_PAGE_SIZE,
  RESTRICTIONS_PATH,
  REVOKE_FORGETS,
  revokeRestriction,
} from './api';
import { CAPABILITIES } from './labels';
import './moderation.css';
import type { AdminPage, AdminRestriction } from './types';

const ISU_PATTERN = /^\d{1,9}$/;
const SEARCH_DELAY = 300;
/**
 * Below this width the columns no longer fit beside the navigation, and the table gives way to rows
 * that stack a restriction's fields.
 */
const NARROW = '(max-width: 1279px)';

type Row = AdminRestriction & Record<string, unknown>;

interface State {
  label: string;
  color: 'orange' | 'gray';
  /** When it ended, and for a revoked one by whom. */
  detail?: string;
}

function stateOf(restriction: AdminRestriction): State {
  if (restriction.active) return { label: 'Действует', color: 'orange' };
  if (restriction.revokedAt) {
    const by = restriction.revokedByIsu ? ` · модератор ИСУ ${restriction.revokedByIsu}` : '';
    return { label: 'Снято', color: 'gray', detail: `${formatDate(restriction.revokedAt)}${by}` };
  }
  if (restriction.expiresAt) {
    return { label: 'Истекло', color: 'gray', detail: formatDate(restriction.expiresAt) };
  }
  return { label: 'Не действует', color: 'gray' };
}

/** The term as it was set; a restriction lifted earlier says so in its state. */
function termOf(restriction: AdminRestriction): string {
  const from = formatDate(restriction.startsAt);
  return restriction.expiresAt
    ? `${from} — ${formatDate(restriction.expiresAt)}`
    : `с ${from}, бессрочно`;
}

/** What tells one restriction of a person from another: the kind and the term. */
function aboutOf(restriction: AdminRestriction): string {
  return `${restriction.user.name}, ${CAPABILITIES[restriction.capability]}, ${termOf(restriction)}`;
}

/**
 * What lifting a restriction does, in full: which one goes, and whether another one keeps the same
 * action closed for the person.
 */
function revokeText(lifted: AdminRestriction, active: AdminRestriction[]): string {
  const text = `Запрет «${CAPABILITIES[lifted.capability]}» (${termOf(lifted)}) для пользователя ${lifted.user.name} будет снят.`;
  const others = active.filter(
    (item) => item.id !== lifted.id && item.active && item.user.isu === lifted.user.isu,
  );
  const same = others.find((item) => item.capability === lifted.capability);
  const all = others.find((item) => item.capability === 'ALL');
  if (same) {
    return `${text} У него останется ещё один такой запрет (${termOf(same)}), поэтому это действие останется закрытым.`;
  }
  if (all) {
    return `${text} У него останется запрет «${CAPABILITIES.ALL}» (${termOf(all)}), поэтому это действие останется закрытым.`;
  }
  return text;
}

/** What the search field puts into the address: a whole ISU number or nothing. */
function isuOf(text: string): string {
  const trimmed = text.trim();
  return ISU_PATTERN.test(trimmed) ? trimmed : '';
}

function caseHref(restriction: AdminRestriction): string {
  return `/admin/moderation?case=${encodeURIComponent(restriction.caseId)}`;
}

/** The restrictions as stacked rows: everything a table row says, with the actions under the text. */
function RestrictionsList({
  items,
  hasState,
  onRevoke,
}: {
  items: AdminRestriction[];
  /** Under "Действующие" every row is active, so the state is not repeated. */
  hasState: boolean;
  onRevoke: (restriction: AdminRestriction) => void;
}) {
  return (
    <List aria-label="Ограничения" hasDividers>
      {items.map((item) => {
        const state = stateOf(item);
        const about = aboutOf(item);
        return (
          <ListItem
            key={item.id}
            align="start"
            startContent={
              <Avatar name={item.user.name} src={item.user.pictureUrl ?? undefined} size={32} />
            }
            label={
              <HStack gap={2} vAlign="center" wrap="wrap">
                <span>{item.user.name}</span>
                {hasState ? <Token label={state.label} color={state.color} size="sm" /> : null}
              </HStack>
            }
            description={
              <VStack gap={1}>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  ИСУ {item.user.isu} · {termOf(item)}
                </Text>
                <Text type="body">{CAPABILITIES[item.capability]}</Text>
                <span className="mod-wrap">{item.reason}</span>
                {hasState && state.detail ? (
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    {state.label} {state.detail}
                  </Text>
                ) : null}
                <HStack gap={3} paddingBlockStart={1} className="mod-list-actions">
                  <Button
                    label="Заявка"
                    aria-label={`Заявка: ${about}`}
                    href={caseHref(item)}
                    variant="secondary"
                    size="sm"
                  />
                  {item.active ? (
                    <Button
                      label="Снять"
                      aria-label={`Снять ограничение: ${about}`}
                      variant="secondary"
                      size="sm"
                      onClick={() => onRevoke(item)}
                    />
                  ) : null}
                </HStack>
              </VStack>
            }
          />
        );
      })}
    </List>
  );
}

/** The text of the search field, and the same text once typing has paused. */
function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

/**
 * `/admin/restrictions`: who may not do what after moderation decisions, with a search by ISU and
 * revoking. `isu`, `all` and `page` live in the query string.
 */
export default function RestrictionsPage() {
  const [query, setQuery] = useQueryState({ isu: '', all: '', page: 0 });
  const [isuText, setIsuText] = useState(query.isu);
  // The address can change under the page (the navigation item, a link): the field follows it,
  // unless the address is what the field itself has just put there.
  const [addressIsu, setAddressIsu] = useState(query.isu);
  if (query.isu !== addressIsu) {
    setAddressIsu(query.isu);
    if (query.isu !== isuOf(isuText)) setIsuText(query.isu);
  }
  // The search waits for a pause in typing before it asks Backend.
  const isu = useDebounced(isuText.trim());
  const valid = isu === '' || ISU_PATTERN.test(isu);
  const active = query.all !== '1';
  const page = Number.isInteger(query.page) && query.page > 0 ? query.page : 0;

  const restrictions = useApiQuery<AdminPage<AdminRestriction>>(RESTRICTIONS_PATH, {
    isu: valid && isu ? Number(isu) : null,
    active,
    page,
    size: RESTRICTIONS_PAGE_SIZE,
  });

  const isNarrow = useMediaQuery(NARROW);
  const [confirming, setConfirming] = useState<AdminRestriction | null>(null);
  // What else the person is forbidden now: the confirmation says when lifting changes nothing yet.
  const sameUser = useApiQuery<AdminPage<AdminRestriction>>(confirming ? RESTRICTIONS_PATH : null, {
    isu: confirming?.user.isu,
    active: true,
    page: 0,
    size: RESTRICTIONS_PAGE_SIZE,
  });
  const revoke = useApiMutation({
    run: (restriction: AdminRestriction) => revokeRestriction(restriction.id),
    forgets: REVOKE_FORGETS,
    done: 'Ограничение снято',
    failed: 'Не удалось снять ограничение',
  });

  function changeIsu(value: string) {
    setIsuText(value);
    // Only a whole number is a search; anything else stays in the field and out of the address.
    setQuery({ isu: isuOf(value) || null, page: null });
  }

  const allColumns: TableColumn<Row>[] = [
    {
      key: 'user',
      header: 'Пользователь',
      width: proportional(1.3, { minWidth: 170 }),
      renderCell: (row) => (
        <span className="mod-user">
          <Avatar name={row.user.name} src={row.user.pictureUrl ?? undefined} size={32} />
          <span className="mod-user-text">
            <span className="mod-strong">{row.user.name}</span>
            <span className="mod-muted">ИСУ {row.user.isu}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'capability',
      header: 'Что запрещено',
      width: proportional(1, { minWidth: 125 }),
      renderCell: (row) => CAPABILITIES[row.capability],
    },
    {
      key: 'reason',
      header: 'Причина',
      width: proportional(1.6, { minWidth: 160 }),
      renderCell: (row) => <span className="mod-wrap">{row.reason}</span>,
    },
    {
      key: 'term',
      header: 'Срок',
      width: proportional(1.1, { minWidth: 150 }),
      renderCell: (row) => <span className="mod-num mod-term">{termOf(row)}</span>,
    },
    {
      key: 'state',
      header: 'Состояние',
      width: proportional(1.1, { minWidth: 150 }),
      renderCell: (row) => {
        const state = stateOf(row);
        return (
          <span className="mod-state">
            <Token label={state.label} color={state.color} size="sm" />
            {state.detail ? <span className="mod-muted mod-num">{state.detail}</span> : null}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: <span className="mod-actions-head">Действия</span>,
      width: pixel(120),
      align: 'end',
      renderCell: (row) => {
        const about = aboutOf(row);
        return (
          <span className="mod-row-actions">
            {row.active ? (
              <Button
                label="Снять"
                aria-label={`Снять ограничение: ${about}`}
                variant="ghost"
                size="sm"
                onClick={() => setConfirming(row)}
              />
            ) : null}
            <IconButton
              label={`Заявка: ${about}`}
              tooltip="Открыть заявку"
              icon={<Gavel size={16} />}
              href={caseHref(row)}
              variant="ghost"
              size="sm"
            />
          </span>
        );
      },
    },
  ];

  // Under "Действующие" every row is active: the state would repeat itself in each.
  const columns = active ? allColumns.filter((column) => column.key !== 'state') : allColumns;

  return (
    <VStack gap={6}>
      <PageHeader title="Ограничения" text="Кому и что запрещено после решений модераторов" />
      <VStack gap={4}>
        <div className="mod-toolbar">
          <TextInput
            type="search"
            label="Номер ИСУ"
            isLabelHidden
            placeholder="Номер ИСУ целиком"
            startIcon={<Search size={16} />}
            inputMode="numeric"
            autoComplete="off"
            width={240}
            hasClear
            value={isuText}
            onChange={changeIsu}
            // A tooltip: an error line under the field would push the table down.
            statusVariant="tooltip"
            status={
              valid
                ? undefined
                : { type: 'error', message: 'Поиск только по номеру ИСУ: до 9 цифр, без имени' }
            }
          />
          <SegmentedControl
            label="Состояние"
            value={active ? 'active' : 'all'}
            onChange={(value) => setQuery({ all: value === 'all' ? '1' : null, page: null })}
          >
            <SegmentedControlItem value="active" label="Действующие" />
            <SegmentedControlItem value="all" label="Все" />
          </SegmentedControl>
        </div>

        <Card padding={0}>
          <Loadable
            resource={restrictions}
            label="Загружаем ограничения"
            errorTitle="Не удалось загрузить ограничения"
          >
            {(data) =>
              !valid ? (
                // Not a search: showing every restriction under it would read as its result.
                <EmptyState
                  icon={<SearchX size={32} />}
                  title="Это не номер ИСУ"
                  description="Поиск идёт по номеру ИСУ целиком: имя или часть номера не подойдут."
                  headingLevel={2}
                />
              ) : data.items.length === 0 ? (
                isu ? (
                  <EmptyState
                    icon={<SearchX size={32} />}
                    title="Ограничений с таким номером ИСУ нет"
                    description={
                      active
                        ? 'Поиск идёт по номеру целиком, часть номера не подойдёт. Снятые и истёкшие ограничения — под «Все».'
                        : 'Поиск идёт по номеру целиком, часть номера не подойдёт.'
                    }
                    headingLevel={2}
                  />
                ) : (
                  <EmptyState
                    icon={<ShieldCheck size={32} />}
                    title={active ? 'Действующих ограничений нет' : 'Ограничений ещё не было'}
                    headingLevel={2}
                  />
                )
              ) : (
                <>
                  {isNarrow ? (
                    <RestrictionsList
                      items={data.items}
                      hasState={!active}
                      onRevoke={setConfirming}
                    />
                  ) : (
                    <Table<Row>
                      data={data.items}
                      columns={columns}
                      idKey="id"
                      verticalAlign="middle"
                      aria-label="Ограничения"
                    />
                  )}
                  <Pagination
                    page={data.page}
                    size={data.size}
                    total={data.total}
                    onChange={(next) => setQuery({ page: next })}
                  />
                </>
              )
            }
          </Loadable>
        </Card>
      </VStack>

      {confirming ? (
        <AlertDialog
          isOpen
          onOpenChange={(open) => {
            if (!open && !revoke.isPending) setConfirming(null);
          }}
          title="Снять ограничение?"
          description={revokeText(confirming, sameUser.data?.items ?? [])}
          actionLabel="Снять"
          cancelLabel="Отмена"
          isActionLoading={revoke.isPending}
          onAction={() => {
            revoke
              .mutateAsync(confirming)
              .then(() => setConfirming(null))
              .catch(() => undefined);
          }}
        />
      ) : null}
    </VStack>
  );
}
