import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Item } from '@astryxdesign/core/Item';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Check, Minus, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { errorText } from '../../api/errors';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { useNotify } from '../../lib/notify';
import { PageHeader } from '../../lib/PageHeader';
import { Panel } from '../../lib/Panel';
import { useSession, useUser } from '../../lib/session';
import { DEVICES_PATH, revoke, signOutInstall, updateScopes } from './api';
import './devices.css';
import {
  canRemove,
  clientOf,
  confirmationOf,
  connectionLine,
  hasPushRegistration,
  installActivity,
  installLine,
  installName,
  itmoProblem,
  PHONES_HINT,
  scopesWithout,
  type Target,
} from './labels';
import type { Connection, Install, ScopeGrant, UserDevices } from './types';

interface Narrowing {
  connection: Connection;
  scope: ScopeGrant;
}

/**
 * What an agent or an MCP server may do. The web only takes a scope away, and only the app gives
 * it back, so a scope is removed with a button and a confirmation, never toggled.
 */
function Scopes({
  connection,
  onRemove,
}: {
  connection: Connection;
  onRemove: (change: Narrowing) => void;
}) {
  const granted = connection.scopes.filter((grant) => grant.granted).length;
  return (
    <VStack
      role="group"
      aria-label={`Доступ ${connection.name}`}
      gap={2}
      className="devices-scopes"
    >
      {connection.scopes.map((grant) => (
        <div key={grant.scope.id} className="devices-scope" data-granted={grant.granted}>
          {grant.granted ? (
            <Check size={16} className="devices-scope-mark" aria-label="Есть доступ:" />
          ) : (
            <Minus size={16} className="devices-scope-mark" aria-label="Нет доступа:" />
          )}
          <span className="devices-scope-text">
            <Text display="block" color={grant.granted ? 'primary' : 'secondary'}>
              {grant.scope.title}
            </Text>
            <Text type="supporting" color="secondary" display="block">
              {grant.scope.description}
            </Text>
          </span>
          {canRemove(connection, grant) ? (
            <Button
              label="Убрать"
              aria-label={`Убрать доступ: ${grant.scope.title}`}
              variant="ghost"
              size="sm"
              onClick={() => onRemove({ connection, scope: grant })}
            />
          ) : grant.granted ? null : (
            <Text type="supporting" color="secondary">
              нет доступа
            </Text>
          )}
        </div>
      ))}
      <Text type="supporting" color="secondary">
        {granted === 1
          ? 'Последний доступ убрать нельзя — отключите устройство целиком. Добавить доступ можно только в приложении.'
          : 'Убранный доступ отсюда не вернуть: добавить его можно только в приложении.'}
      </Text>
    </VStack>
  );
}

/** A connected client; an agent or an MCP server also lists what it may do. */
function ConnectionRow({
  connection,
  isOwn,
  onRemoveScope,
  onEnd,
}: {
  connection: Connection;
  isOwn: boolean;
  onRemoveScope: (change: Narrowing) => void;
  onEnd: (connection: Connection) => void;
}) {
  const client = clientOf(connection);
  const problem = itmoProblem(connection);
  return (
    <li>
      <Item
        startContent={<IconTile icon={client.icon} />}
        label={connection.name}
        description={
          <VStack gap={1} hAlign="start">
            <span>{connectionLine(connection)}</span>
            {isOwn || problem ? (
              <HStack gap={1} wrap="wrap">
                {isOwn ? <Token label="Этот браузер" color="blue" size="sm" /> : null}
                {problem ? <Token label={problem.label} color={problem.color} size="sm" /> : null}
              </HStack>
            ) : null}
          </VStack>
        }
        endContent={
          <Button
            label={isOwn ? 'Выйти' : 'Отключить'}
            aria-label={isOwn ? 'Выйти в этом браузере' : `Отключить ${connection.name}`}
            variant="secondary"
            size="sm"
            onClick={() => onEnd(connection)}
          />
        }
      />
      {problem ? (
        <Text type="supporting" color="secondary" display="block" className="devices-note">
          {problem.text}
        </Text>
      ) : null}
      {connection.client !== 'web' ? (
        <Scopes connection={connection} onRemove={onRemoveScope} />
      ) : null}
    </li>
  );
}

/**
 * A phone with the app. The web can only drop its push registration; a phone without one has
 * nothing left to turn off here, so its row only says so. The button keeps its whole label: in a
 * narrow panel it goes under the text instead of losing words.
 */
function InstallRow({
  install,
  name,
  onEnd,
}: {
  install: Install;
  name: string;
  onEnd: (install: Install) => void;
}) {
  // The calling install signs out in the app itself.
  const canTurnOff = hasPushRegistration(install) && !install.current;
  return (
    <li className="devices-phone">
      <Item
        className="devices-phone-main"
        startContent={<IconTile icon={Smartphone} />}
        label={name}
        description={
          <VStack gap={0}>
            <span>{installLine(install)}</span>
            <span>{installActivity(install)}</span>
          </VStack>
        }
      />
      {canTurnOff ? (
        <span className="devices-phone-action">
          <Button
            label={`Отключить уведомления на ${name}`}
            variant="secondary"
            size="sm"
            onClick={() => onEnd(install)}
          >
            Отключить уведомления
          </Button>
        </span>
      ) : null}
    </li>
  );
}

/**
 * The Backend part of the app's devices screen, the lost-phone path: connected clients with their
 * access and the app installs. ITMO.ID sessions stay on the phone, which ends them after a revoke.
 */
export default function DevicesPage() {
  const user = useUser();
  const session = useSession();
  const notify = useNotify();
  const devices = useApiQuery<UserDevices>(DEVICES_PATH);
  const self = user.connection.id;

  // The target stays while the dialog closes, so its text does not vanish mid-animation.
  const [target, setTarget] = useState<Target | null>(null);
  const [isConfirming, setConfirming] = useState(false);
  const [isLeaving, setLeaving] = useState(false);
  // Backend forgets a phone's model with its push registration; the page keeps the name it showed,
  // so the user still sees which phone was turned off, until the page is opened again.
  const [phoneNames, setPhoneNames] = useState<Record<string, string>>({});

  const narrow = useApiMutation({
    run: ({ connection, scope }: Narrowing) =>
      updateScopes(connection.id, scopesWithout(connection, scope.scope.id)),
    forgets: [DEVICES_PATH],
    done: 'Доступ убран',
    failed: 'Не удалось убрать доступ',
  });
  const disconnect = useApiMutation({
    run: (connection: Connection) => revoke(connection.id),
    forgets: [DEVICES_PATH],
    done: (_, connection) => `${connection.name} отключён`,
    failed: 'Не удалось отключить устройство',
  });
  const signOut = useApiMutation({
    run: (install: Install) => signOutInstall(install.instanceId),
    forgets: [DEVICES_PATH],
    done: (_, install) => `Уведомления на ${installName(install)} отключены`,
    failed: 'Не удалось отключить уведомления',
  });

  function ask(next: Target) {
    setTarget(next);
    setConfirming(true);
  }

  async function confirm() {
    if (!target) return;
    // The mutations show their failures themselves.
    const quiet = () => undefined;
    if ('install' in target) {
      const { install } = target;
      const name = installName(install);
      await signOut
        .mutateAsync(install)
        .then(() => setPhoneNames((names) => ({ ...names, [install.instanceId]: name })))
        .catch(quiet);
    } else if ('scope' in target) {
      await narrow.mutateAsync(target).catch(quiet);
    } else if (target.connection.id !== self) {
      await disconnect.mutateAsync(target.connection).catch(quiet);
    } else {
      setLeaving(true);
      try {
        // Goes to the login page.
        await session.logout();
      } catch (error) {
        notify.error(errorText(error, 'Не удалось выйти'));
      }
      setLeaving(false);
    }
    setConfirming(false);
  }

  const confirmation = target ? confirmationOf(target, self) : null;

  return (
    <VStack gap={6}>
      <PageHeader
        back={{ href: '/me', label: 'Профиль' }}
        title="Устройства"
        text="Браузеры и программы, которым вы открыли доступ к ITMO.Widgets, и телефоны с приложением"
      />

      <Loadable
        resource={devices}
        label="Загружаем устройства"
        errorTitle="Не удалось загрузить устройства"
      >
        {(data) => {
          // A revoked connection waits for the phone to end its ITMO session; nothing to do here.
          const connections = data.connections.filter((connection) => !connection.revokedAt);
          return (
            <div className="devices-columns">
              <Panel
                title="Подключённые"
                hint="Браузеры с этим кабинетом и программы, которые работают от вашего имени: агенты и ИИ-помощники (MCP)"
              >
                {connections.length === 0 ? (
                  <EmptyState title="Нет подключённых клиентов" headingLevel={3} isCompact />
                ) : (
                  <ul className="devices-list" aria-label="Подключённые">
                    {connections.map((connection) => (
                      <ConnectionRow
                        key={connection.id}
                        connection={connection}
                        isOwn={connection.id === self}
                        onRemoveScope={ask}
                        onEnd={(item) => ask({ connection: item })}
                      />
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Телефоны с приложением" hint={PHONES_HINT}>
                {data.installs.length === 0 ? (
                  <EmptyState
                    icon={<Smartphone size={32} />}
                    title="Нет телефонов с приложением"
                    description="Телефон появится здесь, когда вы войдёте в приложении."
                    headingLevel={3}
                    isCompact
                  />
                ) : (
                  <ul className="devices-list" aria-label="Телефоны с приложением">
                    {data.installs.map((install) => (
                      <InstallRow
                        key={install.instanceId}
                        install={install}
                        name={installName(install, phoneNames[install.instanceId])}
                        onEnd={(item) => ask({ install: item })}
                      />
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          );
        }}
      </Loadable>

      <AlertDialog
        isOpen={isConfirming}
        onOpenChange={setConfirming}
        title={confirmation?.title ?? ''}
        description={confirmation?.description ?? ''}
        actionLabel={confirmation?.actionLabel ?? ''}
        isActionLoading={narrow.isPending || disconnect.isPending || signOut.isPending || isLeaving}
        onAction={() => void confirm()}
      />
    </VStack>
  );
}
