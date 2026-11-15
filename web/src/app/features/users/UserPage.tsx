import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Token } from '@astryxdesign/core/Token';
import { Ban, UserX } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../lib/data';
import {
  counted,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
} from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { PageHeader } from '../../lib/PageHeader';
import { useIsu } from '../../lib/router';
import { AccessCard } from './AccessCard';
import { MODERATION_PATH, revokeRestriction, userPath } from './api';
import { CAPABILITY_ACTIONS, groupLine, nameOf, subjectOf } from './labels';
import { RoleTokens } from './RoleTokens';
import type { AdminRestriction, AdminUserDetail } from './types';
import { ClientsPanel, DevicesPanel, GroupsPanel, RestrictionsPanel } from './UserPanels';
import './users.css';

function Stats({ detail }: { detail: AdminUserDetail }) {
  const stats: { label: string; value: string; note?: string }[] = [
    {
      label: 'Последняя активность',
      value: detail.lastSeen ? formatRelative(detail.lastSeen) : '—',
      note: detail.lastSeen ? formatDateTime(detail.lastSeen) : undefined,
    },
    { label: 'Регистрация', value: formatDate(detail.createdAt) },
    { label: 'Друзья', value: formatNumber(detail.friendsCount) },
    { label: 'Ссылки', value: formatNumber(detail.linksCount) },
  ];
  return (
    <Card padding={5}>
      <dl className="users-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="users-stat">
            <dt>{stat.label}</dt>
            <dd className="users-stat-value">{stat.value}</dd>
            {stat.note ? <dd className="users-stat-note">{stat.note}</dd> : null}
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** What the administrator should see before reading the card: the roles and what limits the user. */
function Marks({ detail }: { detail: AdminUserDetail }) {
  const active = detail.restrictions.filter((restriction) => restriction.active).length;
  if (detail.roles.length === 0 && active === 0) return null;
  return (
    <HStack gap={1} vAlign="center" wrap="wrap">
      <RoleTokens roles={detail.roles} />
      {active > 0 ? (
        <Token
          size="sm"
          color="orange"
          icon={<Ban size={14} />}
          label={counted(active, ['ограничение', 'ограничения', 'ограничений'])}
        />
      ) : null}
    </HStack>
  );
}

function UserCard({ detail }: { detail: AdminUserDetail }) {
  const { isu } = detail.user;
  const active = detail.restrictions.filter((restriction) => restriction.active);
  // The restriction stays in the dialog while it closes, so its text does not vanish.
  const [asked, setAsked] = useState<{ restriction: AdminRestriction | null; isOpen: boolean }>({
    restriction: null,
    isOpen: false,
  });
  const revoke = useApiMutation({
    run: (restriction: AdminRestriction) => revokeRestriction(restriction.id),
    forgets: [MODERATION_PATH, userPath(isu)],
    done: 'Ограничение снято',
    failed: 'Не удалось снять ограничение',
  });

  async function apply() {
    if (asked.restriction) await revoke.mutateAsync(asked.restriction).catch(() => undefined);
    setAsked((current) => ({ ...current, isOpen: false }));
  }

  const restrictions = (
    <RestrictionsPanel
      isu={isu}
      restrictions={detail.restrictions}
      onRevoke={(restriction) => setAsked({ restriction, isOpen: true })}
    />
  );

  return (
    <>
      <Stats detail={detail} />
      {/* What limits the user now comes first; a history of ended restrictions closes the card. */}
      {active.length > 0 ? restrictions : null}
      <div className="users-columns">
        <AccessCard detail={detail} />
        <GroupsPanel groups={detail.groups} />
        <DevicesPanel devices={detail.devices} />
        <ClientsPanel clients={detail.clients ?? []} />
      </div>
      {active.length > 0 ? null : restrictions}
      <AlertDialog
        isOpen={asked.isOpen}
        onOpenChange={(isOpen) => {
          if (!revoke.isPending) setAsked((current) => ({ ...current, isOpen }));
        }}
        title="Снять ограничение?"
        description={
          asked.restriction
            ? `${subjectOf(detail.user)} снова сможет ${CAPABILITY_ACTIONS[asked.restriction.capability]}.`
            : ''
        }
        actionLabel="Снять"
        actionVariant="primary"
        isActionLoading={revoke.isPending}
        onAction={apply}
      />
    </>
  );
}

/** `/admin/users/:isu`: one user for the administrator, with everything they may see and change. */
export default function UserPage() {
  const isu = useIsu();
  const user = useApiQuery<AdminUserDetail>(userPath(isu));
  const detail = user.data;
  const [group] = detail?.user.groups ?? [];
  const missing =
    detail === undefined && user.error instanceof ApiError && user.error.code === 'not_found';

  return (
    <VStack gap={6}>
      <PageHeader
        back={{ href: '/admin/users', label: 'Пользователи' }}
        title={detail ? nameOf(detail.user) : 'Пользователь'}
        titleEnd={detail ? <Marks detail={detail} /> : undefined}
        text={[`ИСУ ${isu}`, group ? groupLine(group) : null].filter(Boolean).join(' · ')}
      />
      {missing ? (
        <Card padding={0}>
          <EmptyState
            icon={<UserX size={32} />}
            title="Пользователь не найден"
            description="Проверьте номер ИСУ"
            actions={<Button label="К списку" href="/admin/users" variant="secondary" />}
          />
        </Card>
      ) : (
        <Loadable
          resource={user}
          label="Загружаем пользователя"
          errorTitle="Не удалось загрузить пользователя"
        >
          {(data) => (
            <VStack gap={6}>
              <UserCard detail={data} />
            </VStack>
          )}
        </Loadable>
      )}
    </VStack>
  );
}
