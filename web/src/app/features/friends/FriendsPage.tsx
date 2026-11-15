import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Item } from '@astryxdesign/core/Item';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Tab as TabItem, TabList } from '@astryxdesign/core/TabList';
import { TextInput } from '@astryxdesign/core/TextInput';
import { ChevronRight, Inbox, Search, SearchX, Send, UserPlus, Users, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { counted, formatRelative } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { useNotify } from '../../lib/notify';
import { PageHeader } from '../../lib/PageHeader';
import { useQueryState } from '../../lib/router';
import { useUser } from '../../lib/session';
import { AddFriendDialog, type Known } from './AddFriendDialog';
import { act, LIST_PATHS, staleAfter, type Tab } from './api';
import './friends.css';
import { groupLine, matches, nameOf } from './labels';
import type { FriendAction, UserProfile } from './types';

const TABS: { id: Tab; label: string }[] = [
  { id: 'friends', label: 'Друзья' },
  { id: 'incoming', label: 'Входящие' },
  { id: 'outgoing', label: 'Исходящие' },
];

const EMPTY: Record<Tab, { icon: ReactNode; title: string; text?: string }> = {
  friends: {
    icon: <Users size={32} />,
    title: 'Друзей пока нет',
    text: 'Добавьте друга по номеру ИСУ или в приложении.',
  },
  incoming: {
    icon: <Inbox size={32} />,
    title: 'Входящих заявок нет',
    text: 'Здесь появятся заявки тех, кто хочет добавить вас в друзья.',
  },
  outgoing: {
    icon: <Send size={32} />,
    title: 'Исходящих заявок нет',
    text: 'Здесь видны заявки, на которые вам ещё не ответили.',
  },
};

/** An answer to a request: the transition, its toast and what to say when it fails. */
function useAnswer(
  action: Exclude<FriendAction, 'request'>,
  done: (name: string) => string,
  failed: string,
) {
  return useApiMutation({
    run: (profile: UserProfile) => act(profile.user.isu, action),
    forgets: (profile) => staleAfter(profile.user.isu),
    done: (_, profile) => done(nameOf(profile.user)),
    failed,
  });
}

/** Under the name: the group, and for a request its short name and when the request was sent. */
function about(profile: UserProfile): string | undefined {
  const [group] = profile.user.groups;
  if (!profile.requestedAt) return group ? groupLine(group) : undefined;
  return [group?.name, formatRelative(profile.requestedAt)].filter(Boolean).join(' · ');
}

/**
 * Друзья: friends and requests in three tabs (`tab` in the query string), a search over the loaded
 * friends and "Добавить" by ISU number. Every answer reloads the three lists: one action can move
 * a person between them.
 */
export default function FriendsPage() {
  const user = useUser();
  const notify = useNotify();
  const [query, setQuery] = useQueryState({ tab: 'friends' });
  const tab = TABS.find((item) => item.id === query.tab)?.id ?? 'friends';

  const lists = {
    friends: useApiQuery<UserProfile[]>(LIST_PATHS.friends),
    incoming: useApiQuery<UserProfile[]>(LIST_PATHS.incoming),
    outgoing: useApiQuery<UserProfile[]>(LIST_PATHS.outgoing),
  };
  const panelId = useId();
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const accept = useAnswer(
    'accept',
    (name) => `${name} теперь в друзьях`,
    'Не удалось принять заявку',
  );
  const reject = useAnswer('reject', () => 'Заявка отклонена', 'Не удалось отклонить заявку');
  const cancel = useAnswer('cancel', () => 'Заявка отменена', 'Не удалось отменить заявку');
  /** The person whose request is being answered: their buttons wait. */
  const answering = [accept, reject, cancel].find((answer) => answer.isPending)?.variables?.user
    .isu;

  const select = (next: string) => setQuery({ tab: next });

  /** What the loaded lists say about an ISU number, for the dialog. */
  function relationOf(isu: number): Known | undefined {
    const within = (list: UserProfile[] | undefined) =>
      list?.some((profile) => profile.user.isu === isu) === true;
    if (within(lists.friends.data)) return 'friend';
    if (within(lists.incoming.data)) return 'incoming';
    if (within(lists.outgoing.data)) return 'outgoing';
    return undefined;
  }

  function sent(profile: UserProfile, crossed: boolean) {
    setAdding(false);
    const friends = profile.relationship === 'FRIENDS';
    const name = nameOf(profile.user);
    // Backend answers FRIENDS for a crossed request and for somebody who was a friend already;
    // the second happens only when the lists had not loaded and the dialog could not tell.
    notify.show(
      !friends
        ? 'Заявка отправлена'
        : crossed
          ? `${name} теперь в друзьях`
          : `${name} у вас в друзьях`,
    );
    select(friends ? 'friends' : 'outgoing');
  }

  const counts = lists.friends.data && lists.incoming.data;
  const intro = counts
    ? `${counted(lists.friends.data?.length ?? 0, ['друг', 'друга', 'друзей'])} · ${counted(
        lists.incoming.data?.length ?? 0,
        ['заявка', 'заявки', 'заявок'],
      )}`
    : undefined;
  const label = TABS.find((item) => item.id === tab)?.label ?? '';
  const hasFriends = (lists.friends.data?.length ?? 0) > 0;

  function actions(profile: UserProfile) {
    const name = nameOf(profile.user);
    const isBusy = answering === profile.user.isu;
    if (tab === 'incoming') {
      return (
        <HStack gap={1} vAlign="center">
          <Button
            label="Принять"
            aria-label={`Принять заявку: ${name}`}
            variant="secondary"
            size="sm"
            isDisabled={isBusy}
            onClick={() => accept.mutate(profile)}
          />
          <IconButton
            label={`Отклонить заявку: ${name}`}
            tooltip="Отклонить"
            icon={<X size={16} />}
            variant="ghost"
            size="sm"
            isDisabled={isBusy}
            onClick={() => reject.mutate(profile)}
          />
        </HStack>
      );
    }
    return (
      <Button
        label="Отменить"
        aria-label={`Отменить заявку: ${name}`}
        variant="ghost"
        size="sm"
        isDisabled={isBusy}
        onClick={() => cancel.mutate(profile)}
      />
    );
  }

  return (
    <VStack gap={6}>
      <PageHeader
        title="Друзья"
        text={intro}
        actions={
          <Button
            label="Добавить"
            variant="primary"
            icon={<UserPlus size={16} />}
            onClick={() => setAdding(true)}
          />
        }
      />

      <VStack gap={4}>
        <div className="friends-toolbar">
          <TabList
            value={tab}
            onChange={select}
            role="tablist"
            aria-label="Друзья и заявки"
            className="friends-tabs"
          >
            {TABS.map((item) => {
              // Requests are what waits for an answer; the number of friends is in the header.
              const count = item.id === 'friends' ? 0 : lists[item.id].data?.length;
              return (
                <TabItem
                  key={item.id}
                  value={item.id}
                  label={item.label}
                  panelId={panelId}
                  endContent={count ? <Badge label={count} /> : undefined}
                />
              );
            })}
          </TabList>
          {tab === 'friends' && hasFriends ? (
            <TextInput
              type="search"
              label="Поиск по друзьям"
              isLabelHidden
              placeholder="Имя, группа или номер ИСУ"
              startIcon={<Search size={16} />}
              value={search}
              onChange={setSearch}
              hasClear
              containerClassName="friends-search"
            />
          ) : null}
        </div>

        <Card padding={2} role="tabpanel" id={panelId} aria-label={label}>
          <Loadable
            resource={lists[tab]}
            label="Загружаем друзей"
            errorTitle="Не удалось загрузить список"
          >
            {(profiles) => {
              const shown =
                tab === 'friends'
                  ? profiles.filter((profile) => matches(profile.user, search))
                  : profiles;
              if (shown.length === 0 && profiles.length > 0) {
                return (
                  <EmptyState
                    icon={<SearchX size={32} />}
                    title="Никого не нашли"
                    description="Поиск идёт по вашим друзьям: по имени, группе и номеру ИСУ."
                  />
                );
              }
              if (shown.length === 0) {
                return (
                  <EmptyState
                    icon={EMPTY[tab].icon}
                    title={EMPTY[tab].title}
                    description={EMPTY[tab].text}
                    actions={
                      tab === 'friends' ? (
                        <Button
                          label="Добавить друга"
                          variant="secondary"
                          onClick={() => setAdding(true)}
                        />
                      ) : undefined
                    }
                  />
                );
              }
              return (
                <ul className="friends-rows" role="list" aria-label={label}>
                  {shown.map((profile) => {
                    const name = nameOf(profile.user);
                    return (
                      <Item
                        as="li"
                        key={profile.user.isu}
                        href={`/u/${profile.user.isu}`}
                        startContent={
                          <Avatar
                            name={name}
                            src={profile.user.pictureUrl ?? undefined}
                            size="md"
                          />
                        }
                        label={name}
                        description={about(profile)}
                        labelLines={2}
                        descriptionLines={2}
                        endContent={
                          tab === 'friends' ? (
                            <ChevronRight size={18} className="friends-chevron" />
                          ) : (
                            actions(profile)
                          )
                        }
                      />
                    );
                  })}
                </ul>
              );
            }}
          </Loadable>
        </Card>
      </VStack>

      {adding ? (
        <AddFriendDialog
          self={user.isu}
          relationOf={relationOf}
          onSent={sent}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </VStack>
  );
}
