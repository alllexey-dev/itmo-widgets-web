import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Ban, GraduationCap, MonitorSmartphone, Smartphone, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { buildLabel, channelLabel } from '../../lib/appBuild';
import { CLIENT_KINDS, originLabel, platformLabel } from '../../lib/clients';
import { formatDate, formatDateTime, formatRelative } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { Panel } from '../../lib/Panel';
import { caseHref, restrictionsHref } from './api';
import { CAPABILITIES, devicePlatform, platformCounts, restrictionState } from './labels';
import type { AdminClient, AdminDevice, AdminRestriction, GroupData } from './types';

/** Below this width a row stacks what it shows side by side on a wide screen. */
const PHONE = '(max-width: 640px)';

/** The lines under a row's title; each wraps on its own. */
function Lines({ children }: { children: ReactNode }) {
  return <VStack gap={0.5}>{children}</VStack>;
}

function Line({ children }: { children: ReactNode }) {
  return (
    <Text type="supporting" color="secondary" wordBreak="break-word">
      {children}
    </Text>
  );
}

function Nothing({ icon: EmptyIcon, title }: { icon: LucideIcon; title: string }) {
  return <EmptyState icon={<EmptyIcon size={32} />} title={title} headingLevel={3} isCompact />;
}

function deviceBuild(device: AdminDevice): string {
  return [
    devicePlatform(device),
    device.appVersion ? buildLabel(device.appVersion, device.appBuild) : 'версия: нет данных',
    device.appDistribution ? channelLabel(device.appDistribution) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** When the device last reported its build, if it ever did, and when it last signed in. */
function deviceActivity(device: AdminDevice): string {
  const login = formatDateTime(device.lastLogin);
  return device.appVersionSeenAt
    ? `Активно ${formatRelative(device.appVersionSeenAt)} · вход ${login}`
    : `Вход ${login}`;
}

/**
 * Phones the user signed in on (they register for pushes), with the build each last reported and
 * when. The app on such a phone is also one of the clients below: Backend keeps the two apart, and
 * nothing in either joins them, so the hints say which is which.
 */
export function DevicesPanel({ devices }: { devices: AdminDevice[] }) {
  return (
    <Panel
      title="Устройства"
      hint="Телефоны, на которых входили в приложение"
      action={
        devices.length > 0 ? (
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {platformCounts(devices)}
          </Text>
        ) : undefined
      }
    >
      {devices.length === 0 ? (
        <Nothing icon={Smartphone} title="Нет устройств" />
      ) : (
        <List aria-label="Устройства">
          {devices.map((device, index) => (
            <ListItem
              key={`${device.name}-${device.lastLogin}-${index}`}
              align="start"
              startContent={<IconTile icon={Smartphone} />}
              label={device.name}
              description={
                <Lines>
                  <Line>{deviceBuild(device)}</Line>
                  <Line>{deviceActivity(device)}</Line>
                </Lines>
              }
            />
          ))}
        </List>
      )}
    </Panel>
  );
}

/** A kind a later Backend may add shows as sent. */
function kindOf(kind: string): { label: string; icon: LucideIcon } {
  const kinds: Record<string, { label: string; icon: LucideIcon } | undefined> = CLIENT_KINDS;
  return kinds[kind] ?? { label: kind, icon: MonitorSmartphone };
}

function clientOrigin(client: AdminClient): string {
  return [
    originLabel(client.channel, client.source),
    client.base ? `на основе ${client.base}` : null,
    platformLabel(client.kind, client.browser ?? client.os),
  ]
    .filter(Boolean)
    .join(' · ');
}

/** App installs, site sessions and agents from Backend client statistics, latest first. */
export function ClientsPanel({ clients }: { clients: AdminClient[] }) {
  return (
    <Panel
      title="Клиенты"
      hint="Программы, которые ходят на сервер от имени пользователя: приложение на этих же телефонах, сайт, агенты, MCP"
    >
      {clients.length === 0 ? (
        <Nothing icon={MonitorSmartphone} title="Нет данных о клиентах" />
      ) : (
        <List aria-label="Клиенты">
          {clients.map((client, index) => {
            const kind = kindOf(client.kind);
            return (
              <ListItem
                key={`${client.kind}-${client.firstSeenAt}-${index}`}
                align="start"
                startContent={<IconTile icon={kind.icon} />}
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <span>
                      {client.name ?? kind.label} · {buildLabel(client.version, client.build)}
                    </span>
                    {client.custom ? <Token size="sm" color="purple" label="своя сборка" /> : null}
                  </HStack>
                }
                description={
                  <Lines>
                    <Line>{clientOrigin(client)}</Line>
                    <Line>
                      Активен {formatRelative(client.lastSeenAt)} · с{' '}
                      {formatDate(client.firstSeenAt)}
                    </Line>
                  </Lines>
                }
              />
            );
          })}
        </List>
      )}
    </Panel>
  );
}

/** Every group Backend has stored for the user. */
export function GroupsPanel({ groups }: { groups: GroupData[] }) {
  return (
    <Panel title="Группы">
      {groups.length === 0 ? (
        <Nothing icon={GraduationCap} title="Групп нет" />
      ) : (
        <List aria-label="Группы">
          {groups.map((group) => (
            <ListItem
              key={group.name}
              startContent={<IconTile icon={GraduationCap} />}
              label={group.name}
              description={
                [group.course > 0 ? `${group.course} курс` : null, group.facultyShortName]
                  .filter(Boolean)
                  .join(' · ') || undefined
              }
            />
          ))}
        </List>
      )}
    </Panel>
  );
}

function period(restriction: AdminRestriction): string {
  const end = restriction.revokedAt ?? restriction.expiresAt;
  return end
    ? `${formatDate(restriction.startsAt)} — ${formatDate(end)}`
    : `с ${formatDate(restriction.startsAt)}, бессрочно`;
}

interface RestrictionsProps {
  isu: number;
  restrictions: AdminRestriction[];
  /** Asks to revoke an active restriction. */
  onRevoke: (restriction: AdminRestriction) => void;
}

/** The user's latest restrictions of every state; the full list is in the moderation section. */
export function RestrictionsPanel({ isu, restrictions, onRevoke }: RestrictionsProps) {
  // A phone has no room for the actions beside the text: they go under it.
  const isPhone = useMediaQuery(PHONE);
  return (
    <Panel
      title="Ограничения"
      action={
        restrictions.length > 0 ? (
          <Button
            label={isPhone ? 'Все' : 'Все ограничения'}
            href={restrictionsHref(isu)}
            variant="ghost"
            size="sm"
          />
        ) : undefined
      }
    >
      {restrictions.length === 0 ? (
        <Nothing icon={Ban} title="Ограничений не было" />
      ) : (
        <List aria-label="Ограничения пользователя">
          {restrictions.map((restriction) => {
            const state = restrictionState(restriction);
            const actions = (
              <HStack gap={1} vAlign="center">
                <Button
                  label="Дело"
                  href={caseHref(restriction.caseId)}
                  variant={isPhone ? 'secondary' : 'ghost'}
                  size="sm"
                />
                {restriction.active ? (
                  <Button
                    label="Снять"
                    variant="secondary"
                    size="sm"
                    onClick={() => onRevoke(restriction)}
                  />
                ) : null}
              </HStack>
            );
            return (
              <ListItem
                key={restriction.id}
                align="start"
                startContent={<IconTile icon={Ban} />}
                label={
                  <HStack gap={2} vAlign="center" wrap="wrap">
                    <span>{CAPABILITIES[restriction.capability]}</span>
                    <Token size="sm" color={state.color} label={state.label} />
                  </HStack>
                }
                description={
                  <Lines>
                    <Line>{restriction.reason}</Line>
                    <Line>{period(restriction)}</Line>
                    {isPhone ? (
                      <HStack paddingBlockStart={1} paddingBlockEnd={1}>
                        {actions}
                      </HStack>
                    ) : null}
                  </Lines>
                }
                endContent={isPhone ? undefined : actions}
              />
            );
          })}
        </List>
      )}
    </Panel>
  );
}
