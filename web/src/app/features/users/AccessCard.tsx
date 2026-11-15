import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Divider } from '@astryxdesign/core/Divider';
import { VStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { useState } from 'react';
import { useApiMutation } from '../../lib/data';
import { Panel } from '../../lib/Panel';
import { AUDIT_PATH, setAgentAccess, setModerator, userPath, USERS_PATH } from './api';
import { subjectOf } from './labels';
import type { AdminUserDetail } from './types';

/**
 * What the administrator grants the user: the moderator role, behind a confirmation, and the beta
 * of self-hosted agents. Both switches move only after Backend's answer.
 */
export function AccessCard({ detail }: { detail: AdminUserDetail }) {
  const { isu } = detail.user;
  const name = subjectOf(detail.user);
  // An administrator can do everything already: the switch stays on and locked.
  const admin = detail.roles.includes('ADMIN');
  const moderator = admin || detail.roles.includes('MODERATOR');
  // The question stays in the dialog while it closes, so its text does not flip.
  const [asked, setAsked] = useState({ grant: true, isOpen: false });

  const role = useApiMutation({
    run: (grant: boolean) => setModerator(isu, grant),
    // The list shows roles, the log records the change.
    forgets: [USERS_PATH, AUDIT_PATH],
    done: (_, grant) => (grant ? `${name} теперь модератор` : 'Роль модератора снята'),
    failed: 'Не удалось изменить роль',
  });

  const agents = useApiMutation({
    run: (enabled: boolean) => setAgentAccess(isu, enabled),
    forgets: [userPath(isu), AUDIT_PATH],
    done: ({ enabled }) => (enabled ? 'Доступ к агентам открыт' : 'Доступ к агентам закрыт'),
    failed: 'Не удалось изменить доступ к агентам',
  });

  async function apply() {
    await role.mutateAsync(asked.grant).catch(() => undefined);
    setAsked((current) => ({ ...current, isOpen: false }));
  }

  return (
    <Panel title="Доступ">
      {/* The panel's body is laid out for rows; the switches get the rows' inset. */}
      <VStack gap={4} paddingInline={3} paddingBlockStart={1} paddingBlockEnd={3}>
        <Switch
          label="Модератор"
          description={
            admin ? 'Администратор уже может всё' : 'Решает заявки и ограничивает авторов'
          }
          labelPosition="start"
          labelSpacing="spread"
          value={moderator}
          isDisabled={admin}
          isLoading={role.isPending}
          onChange={(grant) => setAsked({ grant, isOpen: true })}
        />
        <Divider />
        <Switch
          label="Свои агенты"
          description="Может подключать к аккаунту агентов на своём сервере — пока это бета"
          labelPosition="start"
          labelSpacing="spread"
          value={detail.agentAccess}
          isLoading={agents.isPending}
          onChange={(next) => agents.mutate(next)}
        />
      </VStack>
      <AlertDialog
        isOpen={asked.isOpen}
        onOpenChange={(isOpen) => {
          if (!role.isPending) setAsked((current) => ({ ...current, isOpen }));
        }}
        title={asked.grant ? 'Назначить модератором?' : 'Снять роль модератора?'}
        description={
          asked.grant
            ? `${name} сможет решать заявки и ограничивать авторов.`
            : `${name} больше не сможет модерировать ссылки и отзывы.`
        }
        actionLabel={asked.grant ? 'Назначить' : 'Снять роль'}
        actionVariant={asked.grant ? 'primary' : 'destructive'}
        isActionLoading={role.isPending}
        onAction={apply}
      />
    </Panel>
  );
}
