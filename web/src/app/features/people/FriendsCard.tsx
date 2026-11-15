import { Avatar } from '@astryxdesign/core/Avatar';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Item } from '@astryxdesign/core/Item';
import { HStack } from '@astryxdesign/core/Stack';
import { ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { friendsPath } from './api';
import { isDenied } from './denied';
import { Hidden } from './Hidden';
import { groupLine, nameOf } from './labels';
import './people.css';
import type { UserProfile } from './types';

/** A long list starts folded: the page is about the person, not about their friends. */
const SHOWN = 6;

interface Props {
  isu: number;
  /** The profile's `canViewFriends`: without it nothing is asked. */
  allowed: boolean;
}

/** The person's accepted friends; each row opens that person. */
export function FriendsCard({ isu, allowed }: Props) {
  const friends = useApiQuery<UserProfile[]>(allowed ? friendsPath(isu) : null);
  const [isOpen, setIsOpen] = useState(false);
  const denied = isDenied(allowed, friends);
  const total = friends.data?.length ?? 0;

  return (
    <Panel title="Друзья" action={!denied && total > 0 ? <Badge label={total} /> : undefined}>
      {denied ? (
        <Hidden title="Список друзей скрыт" />
      ) : (
        <Loadable
          resource={friends}
          label="Загружаем друзей"
          errorTitle="Не удалось загрузить друзей"
          isCompact
        >
          {(data) =>
            data.length === 0 ? (
              <EmptyState
                icon={<Users size={32} />}
                title="Друзей пока нет"
                headingLevel={3}
                isCompact
              />
            ) : (
              <>
                <ul className="person-rows" role="list" aria-label="Друзья">
                  {(isOpen ? data : data.slice(0, SHOWN)).map((friend) => {
                    const name = nameOf(friend.user);
                    const [group] = friend.user.groups;
                    return (
                      <Item
                        as="li"
                        key={friend.user.isu}
                        href={`/u/${friend.user.isu}`}
                        startContent={
                          <Avatar name={name} src={friend.user.pictureUrl ?? undefined} size="md" />
                        }
                        label={name}
                        description={group ? groupLine(group) : undefined}
                        endContent={<ChevronRight size={18} className="person-chevron" />}
                      />
                    );
                  })}
                </ul>
                {data.length > SHOWN ? (
                  <HStack paddingInline={1} paddingBlockStart={1}>
                    <Button
                      label={isOpen ? 'Свернуть' : `Показать всех: ${data.length}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsOpen(!isOpen)}
                    />
                  </HStack>
                ) : null}
              </>
            )
          }
        </Loadable>
      )}
    </Panel>
  );
}
