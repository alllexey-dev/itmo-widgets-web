import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Item } from '@astryxdesign/core/Item';
import { Text } from '@astryxdesign/core/Text';
import { CalendarOff, Coffee, Users } from 'lucide-react';
import { useMemo } from 'react';
import { useResource } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { friendsToday, type FriendsToday } from './api';
import { friendsNow } from './friendsNow';
import { moscowDate } from './labels';
import { Note } from './Note';
import { Rows } from './Rows';
import { useNow } from './useNow';

const SHOWN = 5;

function Friends({ data, now }: { data: FriendsToday; now: Date }) {
  if (!data.hasFriends) {
    return (
      <EmptyState
        icon={<Users size={32} />}
        title="Друзей пока нет"
        description="Добавьте друга по номеру ИСУ или в приложении."
        headingLevel={3}
        isCompact
      />
    );
  }
  // Backend does not say whether a friend hides the schedule or has a free day, so neither is named.
  if (data.days.length === 0) {
    return (
      <EmptyState
        icon={<CalendarOff size={32} />}
        title="Сегодня у друзей нет занятий"
        description="Здесь видно, кто из друзей на занятиях, если друг открыл вам расписание."
        headingLevel={3}
        isCompact
      />
    );
  }
  const rows = friendsNow(data.days, now);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<Coffee size={32} />}
        title="Сейчас никто не на занятиях"
        description="Сегодня у друзей больше нет пар."
        headingLevel={3}
        isCompact
      />
    );
  }
  return (
    <>
      <Rows label="Друзья сейчас">
        {rows.slice(0, SHOWN).map((friend) => (
          <Item
            as="li"
            key={friend.isu}
            href={`/u/${friend.isu}`}
            startContent={
              <Avatar name={friend.name} src={friend.pictureUrl ?? undefined} size="md" />
            }
            label={friend.name}
            description={friend.text}
            descriptionLines={2}
            endContent={
              friend.until ? (
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {friend.until}
                </Text>
              ) : undefined
            }
          />
        ))}
      </Rows>
      {rows.length > SHOWN ? <Note>И ещё {rows.length - SHOWN} на занятиях сегодня</Note> : null}
    </>
  );
}

/** "Друзья сейчас": who of the friends is at a lesson, from the schedules they open to the visitor. */
export function FriendsNowPanel() {
  const now = useNow();
  const date = moscowDate(now);
  const today = useResource(useMemo(() => friendsToday(date), [date]));
  return (
    <Panel
      title="Друзья сейчас"
      action={<Button label="Все друзья" href="/friends" variant="ghost" size="sm" />}
    >
      <Loadable
        resource={today}
        label="Загружаем расписание друзей"
        errorTitle="Не удалось загрузить расписание друзей"
        isCompact
      >
        {(data) => <Friends data={data} now={now} />}
      </Loadable>
    </Panel>
  );
}
