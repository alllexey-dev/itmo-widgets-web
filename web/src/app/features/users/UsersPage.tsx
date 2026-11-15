import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { Selector, type SelectorOptionType } from '@astryxdesign/core/Selector';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import {
  pixel,
  proportional,
  Table,
  type TableColumn,
  type TablePlugin,
} from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ChevronRight, Search, UserSearch } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApiQuery } from '../../lib/data';
import { counted, formatDate } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { PageHeader } from '../../lib/PageHeader';
import { Pagination } from '../../lib/Pagination';
import { useQueryState } from '../../lib/router';
import { PAGE_SIZE, QUERY_LIMIT, USERS_PATH } from './api';
import { nameOf } from './labels';
import type { AdminUserItem, UsersPage as UsersPageData } from './types';
import { UserMarks } from './UserMarks';
import './users.css';

const DEBOUNCE_MS = 300;

/** The roles `GET /api/admin/users?role=` takes, as the filter offers them. */
const ROLE_OPTIONS: SelectorOptionType[] = [
  { value: 'ADMIN', label: 'Администраторы' },
  { value: 'MODERATOR', label: 'Модераторы' },
];

/** `restricted=true` is a restriction in force now, `false` none; absent is everybody. */
const RESTRICTED_OPTIONS: SelectorOptionType[] = [
  { value: 'true', label: 'Есть' },
  { value: 'false', label: 'Нет' },
];

interface FilterProps {
  /** The name of the filter: the closed trigger shows it unset and "Роль: Модераторы" once set. */
  label: string;
  value: string;
  options: SelectorOptionType[];
  onChange: (value: string | null) => void;
}

/** One filter next to the search: a closed trigger that reads as the whole clause once set. */
function Filter({ label, value, options, onChange }: FilterProps) {
  return (
    <Selector
      label={label}
      isLabelHidden
      placeholder={label}
      hasClear
      value={value || null}
      options={options}
      controlClassName={value ? 'users-filter-set' : undefined}
      renderValue={(option) => `${label}: ${option.label ?? option.value}`}
      onChange={onChange}
    />
  );
}

/** Only what Backend takes: another value would be a 400, so the page ignores it. */
function roleOf(value: string): string {
  return value === 'ADMIN' || value === 'MODERATOR' ? value : '';
}

function restrictedOf(value: string): string {
  return value === 'true' || value === 'false' ? value : '';
}

/** Below this width the table gives way to two-line rows. */
const PHONE = '(max-width: 640px)';

const COLUMNS: TableColumn<AdminUserItem>[] = [
  {
    key: 'name',
    header: 'Пользователь',
    width: proportional(1.8, { minWidth: 190 }),
    renderCell: (user) => (
      <HStack gap={3} vAlign="center">
        <UserAvatar user={user} size="sm" />
        <Link href={userHref(user)} weight="medium" color="primary">
          {nameOf(user)}
        </Link>
      </HStack>
    ),
  },
  {
    key: 'isu',
    header: 'ИСУ',
    width: pixel(96),
    align: 'end',
    renderCell: (user) => <Text hasTabularNumbers>{user.isu}</Text>,
  },
  {
    key: 'group',
    header: 'Группа',
    width: proportional(1, { minWidth: 96 }),
    renderCell: (user) => user.groups[0]?.name ?? <Text color="secondary">—</Text>,
  },
  {
    key: 'marks',
    header: 'Роли и ограничения',
    width: proportional(1.8, { minWidth: 170 }),
    renderCell: (user) =>
      user.roles.length > 0 || user.activeRestrictions > 0 ? (
        <UserMarks roles={user.roles} activeRestrictions={user.activeRestrictions} />
      ) : (
        <Text color="secondary">—</Text>
      ),
  },
  {
    key: 'createdAt',
    header: 'Регистрация',
    width: pixel(136),
    align: 'end',
    renderCell: (user) => (
      <Text color="secondary" hasTabularNumbers>
        {formatDate(user.createdAt)}
      </Text>
    ),
  },
];

/** The avatar of a row: the initials come from the real name, never from the fallback text. */
function UserAvatar({ user, size }: { user: AdminUserItem; size: 'sm' | 'md' }) {
  return (
    <Avatar name={user.name.trim() || undefined} src={user.pictureUrl ?? undefined} size={size} />
  );
}

function userHref(user: AdminUserItem): string {
  return `/admin/users/${user.isu}`;
}

/**
 * A click anywhere in a row opens the user; the name stays the row's one link, for the keyboard,
 * a reader and "open in a new tab".
 */
function useRowLink(): Record<string, TablePlugin<AdminUserItem>> {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      rowLink: {
        transformBodyRow: (props, user) => ({
          ...props,
          htmlProps: {
            ...props.htmlProps,
            onClick: (event) => {
              props.htmlProps.onClick?.(event);
              const onControl = (event.target as Element).closest('a, button') !== null;
              const isSelecting = window.getSelection()?.toString() !== '';
              if (event.defaultPrevented || onControl || isSelecting) return;
              void navigate(userHref(user));
            },
          },
        }),
      },
    }),
    [navigate],
  );
}

function UsersTable({ users }: { users: AdminUserItem[] }) {
  const plugins = useRowLink();
  return (
    <Table<AdminUserItem>
      aria-label="Пользователи"
      className="users-table"
      data={users}
      columns={COLUMNS}
      idKey="isu"
      plugins={plugins}
      hasHover
    />
  );
}

function UsersList({ users }: { users: AdminUserItem[] }) {
  return (
    <List aria-label="Пользователи" hasDividers>
      {users.map((user) => (
        <ListItem
          key={user.isu}
          href={userHref(user)}
          startContent={<UserAvatar user={user} size="md" />}
          label={nameOf(user)}
          description={
            <VStack gap={1}>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {[`ИСУ ${user.isu}`, user.groups[0]?.name, formatDate(user.createdAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <UserMarks roles={user.roles} activeRestrictions={user.activeRestrictions} />
            </VStack>
          }
          endContent={<ChevronRight size={18} className="users-chevron" />}
        />
      ))}
    </List>
  );
}

/**
 * `/admin/users`: everybody who signed in, searched by ISU prefix, name or group and narrowed by
 * role and by restrictions in force.
 */
export default function UsersPage() {
  const [query, setQuery] = useQueryState({ q: '', page: 0, role: '', restricted: '' });
  const search = query.q.trim();
  const role = roleOf(query.role);
  const restricted = restrictedOf(query.restricted);
  const isFiltered = role !== '' || restricted !== '';
  const page = Math.max(0, Math.trunc(query.page));
  const isPhone = useMediaQuery(PHONE);

  // The field shows what is typed; the address and the request follow once the typing stops.
  const [text, setText] = useState(query.q);
  const [applied, setApplied] = useState(search);
  if (applied !== search) {
    // The address changed by itself (the navigation item, back): the field follows it.
    setApplied(search);
    if (text.trim() !== search) setText(search);
  }
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function type(value: string) {
    const next = value.slice(0, QUERY_LIMIT);
    setText(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery({ q: next.trim(), page: null }), DEBOUNCE_MS);
  }

  const users = useApiQuery<UsersPageData>(USERS_PATH, {
    query: search,
    role,
    restricted,
    page,
    size: PAGE_SIZE,
  });
  const clearFilters = () => setQuery({ role: null, restricted: null, page: null });

  return (
    <VStack gap={6}>
      <PageHeader title="Пользователи" text="Поиск по ИСУ, имени или группе" />
      <VStack gap={3}>
        <HStack gap={4} vAlign="center" wrap="wrap">
          <div className="users-search">
            <TextInput
              type="search"
              label="Поиск"
              isLabelHidden
              placeholder="ИСУ, имя или группа"
              autoComplete="off"
              startIcon={<Search size={16} />}
              hasClear
              width="100%"
              value={text}
              onChange={type}
            />
          </div>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Filter
              label="Роль"
              value={role}
              options={ROLE_OPTIONS}
              onChange={(next) => setQuery({ role: next, page: null })}
            />
            <Filter
              label="Ограничения"
              value={restricted}
              options={RESTRICTED_OPTIONS}
              onChange={(next) => setQuery({ restricted: next, page: null })}
            />
          </HStack>
          {users.data ? (
            <Text color="secondary" aria-live="polite">
              {counted(users.data.total, ['пользователь', 'пользователя', 'пользователей'])}
            </Text>
          ) : null}
        </HStack>
        <Card padding={0}>
          <Loadable
            resource={users}
            label="Загружаем пользователей"
            errorTitle="Не удалось загрузить пользователей"
          >
            {(list) => (
              <>
                {list.items.length === 0 ? (
                  <EmptyState
                    icon={<UserSearch size={32} />}
                    title={search || isFiltered ? 'Никого не нашли' : 'Пользователей пока нет'}
                    description={
                      isFiltered
                        ? 'Под выбранные условия никто не подходит'
                        : search
                          ? 'Проверьте запрос: ИСУ, часть имени или группы'
                          : undefined
                    }
                    actions={
                      isFiltered ? (
                        <Button
                          label="Сбросить фильтры"
                          variant="secondary"
                          onClick={clearFilters}
                        />
                      ) : undefined
                    }
                  />
                ) : isPhone ? (
                  <UsersList users={list.items} />
                ) : (
                  <UsersTable users={list.items} />
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
