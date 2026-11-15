import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Check, UserPlus, UserX } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { BackLink } from '../../lib/PageHeader';
import { useIsu } from '../../lib/router';
import { useUser } from '../../lib/session';
import { act, profilePath, staleAfter } from './api';
import { FriendsCard } from './FriendsCard';
import { can, groupLine, nameOf } from './labels';
import './people.css';
import { ScheduleCard } from './ScheduleCard';
import { SportCard } from './SportCard';
import type { FriendAction, UserProfile } from './types';

/** A friendship transition from this page: its toast and what to say when it fails. */
function useChange(
  isu: number,
  action: FriendAction,
  done: (profile: UserProfile) => string,
  failed: string,
) {
  return useApiMutation({
    run: () => act(isu, action),
    forgets: () => staleAfter(isu),
    done,
    failed,
  });
}

const friendsNow = (profile: UserProfile) => `${nameOf(profile.user)} теперь в друзьях`;

/**
 * A person as the visitor may see them: the relationship with its one next step and the cards their
 * audiences open. Backend decides every capability; the page only asks for what it was allowed.
 */
export default function PersonPage() {
  const isu = useIsu();
  const viewer = useUser();
  const person = useApiQuery<UserProfile>(profilePath(isu));
  const [removing, setRemoving] = useState(false);

  const request = useChange(
    isu,
    'request',
    // A request to somebody who has already asked makes a friend at once.
    (next) => (next.relationship === 'FRIENDS' ? friendsNow(next) : 'Заявка отправлена'),
    'Не удалось отправить заявку',
  );
  const accept = useChange(isu, 'accept', friendsNow, 'Не удалось принять заявку');
  const reject = useChange(isu, 'reject', () => 'Заявка отклонена', 'Не удалось отклонить заявку');
  const cancel = useChange(isu, 'cancel', () => 'Заявка отменена', 'Не удалось отменить заявку');
  const remove = useChange(
    isu,
    'remove',
    () => 'Вы больше не друзья',
    'Не удалось удалить из друзей',
  );
  const isBusy = [request, accept, reject, cancel, remove].some((change) => change.isPending);

  const back = (
    <HStack>
      <BackLink href="/friends" label="Друзья" />
    </HStack>
  );

  if (person.error instanceof ApiError && person.error.status === 404 && !person.loading) {
    return (
      <VStack gap={6}>
        {back}
        <Card padding={5}>
          <EmptyState
            icon={<UserX size={32} />}
            title="Пользователь не найден"
            description="Этого человека нет в ITMO.Widgets."
            headingLevel={1}
          />
        </Card>
      </VStack>
    );
  }

  function relation({ relationship }: UserProfile) {
    if (viewer.isu === isu) {
      return (
        <>
          <Token label="Это вы" />
          <Button label="Ваш профиль" href="/me" variant="secondary" size="sm" />
        </>
      );
    }
    switch (relationship) {
      case 'FRIENDS':
        return (
          <>
            <Token label="В друзьях" color="green" icon={<Check size={14} />} />
            <Button
              label="Удалить из друзей"
              variant="ghost"
              size="sm"
              isDisabled={isBusy}
              onClick={() => setRemoving(true)}
            />
          </>
        );
      case 'INCOMING':
        return (
          <>
            <Token label="Хочет добавить вас в друзья" color="blue" />
            <Button
              label="Принять"
              variant="primary"
              size="sm"
              isDisabled={isBusy}
              onClick={() => accept.mutate()}
            />
            <Button
              label="Отклонить"
              variant="ghost"
              size="sm"
              isDisabled={isBusy}
              onClick={() => reject.mutate()}
            />
          </>
        );
      case 'OUTGOING':
        return (
          <>
            <Token label="Заявка отправлена" />
            <Button
              label="Отменить заявку"
              variant="ghost"
              size="sm"
              isDisabled={isBusy}
              onClick={() => cancel.mutate()}
            />
          </>
        );
      case 'NONE':
        return (
          <Button
            label="Добавить в друзья"
            variant="primary"
            size="sm"
            icon={<UserPlus size={16} />}
            isDisabled={isBusy}
            onClick={() => request.mutate()}
          />
        );
      default:
        return null;
    }
  }

  return (
    <VStack gap={6}>
      {back}
      <Loadable
        resource={person}
        label="Загружаем профиль"
        errorTitle="Не удалось загрузить профиль"
      >
        {(data) => {
          const { user } = data;
          const name = nameOf(user);
          return (
            <VStack gap={6}>
              <header className="person-hero">
                <Avatar name={name} src={user.pictureUrl ?? undefined} size={72} />
                <VStack gap={1}>
                  <Heading level={1}>{name}</Heading>
                  {user.groups.map((group) => (
                    <Text key={group.name} color="secondary">
                      {groupLine(group)}
                    </Text>
                  ))}
                </VStack>
                <div className="person-relation">{relation(data)}</div>
              </header>

              <div className="person-columns">
                <ScheduleCard isu={isu} allowed={can(user, 'canViewSchedule')} />
                <VStack gap={6}>
                  <SportCard isu={isu} allowed={can(user, 'canViewSport')} />
                  <FriendsCard isu={isu} allowed={can(user, 'canViewFriends')} />
                </VStack>
              </div>

              <AlertDialog
                isOpen={removing}
                onOpenChange={setRemoving}
                title="Удалить из друзей?"
                description={`${name} перестанет видеть то, что вы открыли только друзьям.`}
                actionLabel="Удалить"
                actionVariant="destructive"
                cancelLabel="Отмена"
                onAction={() => {
                  setRemoving(false);
                  remove.mutate();
                }}
              />
            </VStack>
          );
        }}
      </Loadable>
    </VStack>
  );
}
