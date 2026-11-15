import { Avatar } from '@astryxdesign/core/Avatar';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Globe, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useId } from 'react';
import { errorText } from '../../api/errors';
import { useApiQuery } from '../../lib/data';
import { formatDate, sentence } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { LoadError } from '../../lib/LoadError';
import { useNotify } from '../../lib/notify';
import { PageHeader } from '../../lib/PageHeader';
import { displayName, roleLabel, useSession, useUser } from '../../lib/session';
import { RESTRICTIONS_PATH } from './api';
import { groupLine, restrictionLine } from './labels';
import { PrivacyCard } from './PrivacyCard';
import './profile.css';
import type { UserRestriction } from './types';

/** The restrictions in force with the moderator's reasons; nothing without one. */
function Restrictions() {
  const restrictions = useApiQuery<UserRestriction[]>(RESTRICTIONS_PATH);
  const { data, error, loading, reload } = restrictions;

  if (data === undefined) {
    if (!error || loading) return null;
    return (
      <Card padding={3}>
        <LoadError
          error={error}
          title="Не удалось проверить ограничения"
          onRetry={reload}
          isCompact
        />
      </Card>
    );
  }
  if (data.length === 0) return null;
  const title = data.length > 1 ? 'Действуют ограничения' : 'Действует ограничение';
  return (
    <VStack as="section" aria-label={title}>
      <Banner
        status="warning"
        title={title}
        description={
          <VStack gap={1}>
            {data.map((restriction) => (
              <Text key={restriction.id}>
                {restrictionLine(restriction)} Причина: «{restriction.reason}»
              </Text>
            ))}
          </VStack>
        }
      />
    </VStack>
  );
}

/** The signed-in user: who they are, who sees their data, a restriction in force and this sign-in. */
export default function ProfilePage() {
  const user = useUser();
  const session = useSession();
  const notify = useNotify();
  const nameId = useId();
  const sessionId = useId();
  const devicesId = useId();
  const name = displayName(user);
  const role = roleLabel(user);
  const { connection } = user;

  async function logout() {
    try {
      // Goes to the login page.
      await session.logout();
    } catch (error) {
      notify.error(errorText(error, 'Не удалось выйти'));
    }
  }

  return (
    <VStack gap={6}>
      <PageHeader
        title="Профиль и приватность"
        text="Кто видит ваши данные и вход в этом браузере"
      />

      <Restrictions />

      <div className="profile-columns">
        <VStack gap={6}>
          <Card padding={5}>
            <HStack as="section" gap={4} vAlign="center" aria-labelledby={nameId}>
              <Avatar name={name} src={user.pictureUrl ?? undefined} size={64} />
              <VStack gap={1} hAlign="start" className="profile-who">
                <Heading level={2} id={nameId}>
                  {name}
                </Heading>
                {user.groups.map((group) => (
                  <Text key={group.name} color="secondary">
                    {groupLine(group)}
                  </Text>
                ))}
                <Text color="secondary">ИСУ {user.isu}</Text>
                {role ? <Token label={role} icon={<ShieldCheck size={14} />} size="sm" /> : null}
              </VStack>
            </HStack>
          </Card>

          <PrivacyCard />
        </VStack>

        <VStack gap={6}>
          <Card padding={5}>
            <VStack as="section" gap={4} aria-labelledby={sessionId}>
              <Heading level={2} id={sessionId}>
                Этот вход
              </Heading>
              <HStack gap={3} vAlign="center">
                <IconTile icon={Globe} />
                <VStack gap={0} className="profile-who">
                  <Text weight="medium">{connection.name}</Text>
                  <Text type="supporting" color="secondary">
                    Подключён в приложении {formatDate(connection.createdAt)}
                  </Text>
                </VStack>
              </HStack>
              <VStack gap={2}>
                <Text color="secondary">Вход закончится после 30 дней без действий.</Text>
                {role ? (
                  <Text color="secondary">
                    {sentence(
                      `Для действий модератора и администратора вход нужно подтверждать на телефоне раз в 7 дней, последний раз — ${formatDate(connection.approvedAt)}`,
                    )}
                  </Text>
                ) : null}
              </VStack>
              <HStack>
                <Button
                  label="Выйти"
                  icon={<LogOut size={16} />}
                  variant="secondary"
                  clickAction={logout}
                />
              </HStack>
            </VStack>
          </Card>

          <Card padding={5}>
            <VStack as="section" gap={4} aria-labelledby={devicesId}>
              <VStack gap={1}>
                <Heading level={2} id={devicesId}>
                  Устройства
                </Heading>
                <Text color="secondary">
                  Браузеры и программы с доступом к вашим данным, телефоны с приложением.
                </Text>
                <Text color="secondary">
                  Потеряли телефон? Выйдите на нём из приложения на другом телефоне: Профиль →
                  Устройства.
                </Text>
              </VStack>
              <HStack>
                <Button
                  label="Открыть устройства"
                  href="/me/devices"
                  icon={<MonitorSmartphone size={16} />}
                  variant="secondary"
                />
              </HStack>
            </VStack>
          </Card>
        </VStack>
      </div>
    </VStack>
  );
}
