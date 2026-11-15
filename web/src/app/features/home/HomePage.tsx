import { VStack } from '@astryxdesign/core/Stack';
import { PageHeader } from '../../lib/PageHeader';
import { hasAccess, useUser } from '../../lib/session';
import { AttentionPanel } from './AttentionPanel';
import { DevicesPanel } from './DevicesPanel';
import { FriendsNowPanel } from './FriendsNowPanel';
import { givenNameOf, greeting } from './labels';
import { SportPanel } from './SportPanel';
import { WeekCard } from './WeekCard';
import './home.css';

/**
 * Главная: one page for every role. What waits for the visitor comes first, the administrator also
 * gets the week in numbers, then the friends, the sport and the devices. Each block loads, empties
 * and fails on its own.
 */
export default function HomePage() {
  const user = useUser();
  const name = givenNameOf(user);
  const [group] = user.groups;
  const where = group
    ? [group.name, group.course > 0 ? `${group.course} курс` : null, group.facultyShortName]
        .filter(Boolean)
        .join(' · ')
    : undefined;

  return (
    <VStack gap={6}>
      <PageHeader title={name ? `${greeting()}, ${name}` : greeting()} text={where} />
      <AttentionPanel />
      {hasAccess(user, 'admin') ? <WeekCard /> : null}
      <div className="home-columns">
        <FriendsNowPanel />
        <SportPanel />
      </div>
      <DevicesPanel />
    </VStack>
  );
}
