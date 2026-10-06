import { useState } from 'react';
import { Link, useParams } from 'react-router';
import type { GroupData } from '../../api/admin';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errors';
import {
  Avatar,
  buttonClasses,
  Card,
  CardHeader,
  Chip,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  formatDate,
  formatDateTime,
  formatNumber,
  formatRelative,
  Icon,
  LoadingIndicator,
  PageHeader,
  Stat,
  Switch,
  Table,
  useSnackbars,
} from '../../ui';
import { RestrictionsTable } from '../../shared/RestrictionsTable';
import { useModeratorRole, useUser } from './api';
import { RoleBadges } from './roles';
import type { AdminUserDetail } from './types';
import styles from './UserPage.module.css';

function BackLink() {
  return (
    <Link to="/admin/users" className={buttonClasses({ variant: 'text', size: 'small' })}>
      <Icon name="arrow_back" size={18} />
      Пользователи
    </Link>
  );
}

export function UserPage() {
  const isu = Number(useParams().isu);
  const user = useUser(isu);

  if (user.isPending) return <LoadingIndicator label="Загружаем пользователя" />;
  if (user.isError) {
    const missing = user.error instanceof ApiError && user.error.code === 'not_found';
    return (
      <div className={styles.page}>
        <BackLink />
        <Card>
          {missing ? (
            <EmptyState
              icon="person_off"
              title="Пользователь не найден"
              description="Проверьте номер ИСУ."
            />
          ) : (
            <ErrorState
              title="Не удалось загрузить пользователя"
              description={errorText(user.error, 'Попробуйте ещё раз.')}
              onRetry={() => void user.refetch()}
              retrying={user.isFetching}
            />
          )}
        </Card>
      </div>
    );
  }
  return <UserView detail={user.data} />;
}

function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

function UserView({ detail }: { detail: AdminUserDetail }) {
  const { user } = detail;
  const current = user.groups[0];
  return (
    <div className={styles.page}>
      <BackLink />
      <section aria-labelledby="user-name">
        <PageHeader
          titleId="user-name"
          leading={<Avatar name={user.name} src={user.pictureUrl} size={80} decorative />}
          title={user.name}
          description={`ИСУ ${user.isu}${current ? ` · ${groupLine(current)}` : ''}`}
          actions={<RoleBadges roles={detail.roles} />}
        />
      </section>

      <Card as="section" aria-labelledby="user-access">
        <CardHeader title={<span id="user-access">Доступ</span>} />
        <ModeratorSwitch detail={detail} />
      </Card>

      <div className={styles.stats}>
        <Stat
          icon="schedule"
          label="Последняя активность"
          value={detail.lastSeen ? formatRelative(detail.lastSeen) : '—'}
          caption={detail.lastSeen ? formatDateTime(detail.lastSeen) : 'Нет данных'}
        />
        <Stat icon="event" label="Регистрация" value={formatDate(detail.createdAt)} />
        <Stat icon="group" label="Друзья" value={formatNumber(detail.friendsCount)} />
        <Stat icon="link" label="Ссылки" value={formatNumber(detail.linksCount)} />
      </div>

      <div className={styles.columns}>
        <Card as="section" aria-labelledby="user-devices">
          <CardHeader title={<span id="user-devices">Устройства</span>} />
          <Table
            caption="Устройства"
            columns={[
              {
                key: 'name',
                header: 'Устройство',
                render: (device) => (
                  <span className={styles.device}>
                    <Icon name="smartphone" size={20} />
                    {device.name}
                  </span>
                ),
              },
              {
                key: 'lastLogin',
                header: 'Последний вход',
                align: 'end',
                render: (device) => formatDateTime(device.lastLogin),
              },
            ]}
            rows={detail.devices}
            rowKey={(device) => `${device.name}-${device.lastLogin}`}
            bleed
            empty={{ icon: 'mobile_off', title: 'Нет устройств' }}
          />
        </Card>
        <Card as="section" aria-labelledby="user-groups">
          <CardHeader
            title={<span id="user-groups">Группы</span>}
            subtitle="Все группы, которые были у пользователя"
          />
          {detail.groups.length === 0 ? (
            <p className="m3-muted">Групп нет</p>
          ) : (
            <ul className={styles.groups}>
              {detail.groups.map((group) => (
                <li key={group.name}>
                  <Chip icon="school">{groupLine(group)}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card as="section" aria-labelledby="user-restrictions">
        <CardHeader title={<span id="user-restrictions">Ограничения</span>} />
        <RestrictionsTable
          caption="Ограничения пользователя"
          rows={detail.restrictions}
          showUser={false}
          bleed
          empty={{ title: 'Ограничений не было' }}
        />
      </Card>
    </div>
  );
}

function ModeratorSwitch({ detail }: { detail: AdminUserDetail }) {
  const snackbars = useSnackbars();
  const role = useModeratorRole(detail.user.isu);
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const isAdmin = detail.roles.includes('ADMIN');
  const isModerator = detail.roles.includes('MODERATOR');
  const name = detail.user.name;

  const apply = () => {
    if (confirming === null) return;
    const grant = confirming;
    role.mutate(grant, {
      onSuccess: () => {
        setConfirming(null);
        snackbars.show(grant ? `${name} теперь модератор` : 'Роль модератора снята');
      },
      onError: (error) => snackbars.error(errorText(error, 'Не удалось изменить роль')),
    });
  };

  return (
    <div>
      <Switch
        label="Модератор"
        description={
          isAdmin ? 'Администратор уже может всё' : 'Решает заявки и ограничивает авторов'
        }
        checked={isAdmin || isModerator}
        disabled={isAdmin || role.isPending}
        onChange={setConfirming}
      />
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={apply}
        loading={role.isPending}
        title={confirming ? 'Назначить модератором?' : 'Снять роль модератора?'}
        description={
          confirming
            ? `${name} сможет решать заявки и ограничивать авторов.`
            : `${name} больше не сможет модерировать ссылки.`
        }
        confirmLabel={confirming ? 'Назначить' : 'Снять роль'}
        danger={confirming === false}
      />
    </div>
  );
}
