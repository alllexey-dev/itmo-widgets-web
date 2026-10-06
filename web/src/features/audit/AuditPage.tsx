import type { IconName } from '../../ui/icons';
import type { components } from '../../api/schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { DEFAULT_PAGE_SIZE, type AdminPage } from '../../api/admin';
import { api } from '../../api/client';
import { errorText } from '../../api/errors';
import {
  Card,
  ErrorState,
  formatDateTime,
  Icon,
  LoadingOverlay,
  PageHeader,
  Pagination,
  Table,
  type TableColumn,
} from '../../ui';
import styles from './AuditPage.module.css';

/** `AdminAuditEntry`. */
export type AuditEntry = components['schemas']['AdminAuditEntry'];

const ACTIONS: Record<string, { label: string; icon: IconName }> = {
  ROLE_GRANTED: { label: 'Выдана роль', icon: 'person_add' },
  ROLE_REVOKED: { label: 'Снята роль', icon: 'person_remove' },
  MODERATION_SETTINGS_CHANGED: { label: 'Правила модерации', icon: 'tune' },
  APP_VERSION_CHANGED: { label: 'Версия приложения', icon: 'system_update' },
  REVIEWS_SYNC_STARTED: { label: 'Синхронизация отзывов', icon: 'sync' },
  SERVICE_CREDENTIAL_REPLACED: { label: 'Замена учётных данных', icon: 'key' },
  AI_SUMMARIES_RUN_STARTED: { label: 'Пересчёт ИИ-сводок', icon: 'auto_awesome' },
  AI_SUMMARY_HIDDEN: { label: 'Сводка скрыта', icon: 'visibility_off' },
  AI_SUMMARY_SHOWN: { label: 'Сводка показана', icon: 'visibility' },
  AI_SUMMARY_REGENERATION_REQUESTED: { label: 'Пересчёт сводки', icon: 'refresh' },
};

const TARGETS: Record<string, string> = {
  'moderation-settings': 'Настройки модерации',
  'app-version': 'Версия приложения',
  'reviews-sync': 'Отзывы',
  'credential:MY_ITMO_REFRESH_TOKEN': 'My ITMO · refresh-токен',
  'credential:ISU_KEYCLOAK_IDENTITY': 'ИСУ · cookie KEYCLOAK_IDENTITY',
  'credential:GEMINI_API_KEY': 'Gemini · API-ключ',
  'ai-summaries': 'ИИ-сводки',
};

function Target({ target }: { target: string }) {
  const user = /^user:(\d+)$/.exec(target);
  if (user) return <Link to={`/admin/users/${user[1]}`}>ИСУ {user[1]}</Link>;
  const teacher = /^teacher:(\d+)$/.exec(target);
  if (teacher) return <>Преподаватель · ИСУ {teacher[1]}</>;
  return <>{TARGETS[target] ?? target}</>;
}

const COLUMNS: TableColumn<AuditEntry>[] = [
  {
    key: 'time',
    header: 'Когда',
    width: 160,
    render: (entry) => <span className={styles.nowrap}>{formatDateTime(entry.createdAt)}</span>,
  },
  {
    key: 'actor',
    header: 'Кто',
    render: (entry) => (
      <span className={styles.actor}>
        <Link to={`/admin/users/${entry.actorIsu}`}>{entry.actorName}</Link>
        <span className="m3-muted">ИСУ {entry.actorIsu}</span>
      </span>
    ),
  },
  {
    key: 'action',
    header: 'Действие',
    minWidth: 180,
    render: (entry) => {
      const action = ACTIONS[entry.action];
      return (
        <span className={styles.action}>
          <Icon name={action?.icon ?? 'history'} size={20} />
          {action?.label ?? entry.action}
        </span>
      );
    },
  },
  { key: 'target', header: 'Объект', render: (entry) => <Target target={entry.target} /> },
  {
    key: 'details',
    header: 'Подробности',
    minWidth: 200,
    render: (entry) =>
      entry.details ? (
        <code className={styles.details}>{entry.details}</code>
      ) : (
        <span className="m3-muted">—</span>
      ),
  },
];

export function AuditPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(0, Number(params.get('page')) || 0);
  const audit = useQuery({
    queryKey: ['admin', 'audit', page],
    queryFn: ({ signal }) =>
      api.get<AdminPage<AuditEntry>>('/api/admin/audit', {
        query: { page, size: DEFAULT_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Журнал"
        description="Роли, правила модерации, версия приложения, синхронизация отзывов, учётные данные и ИИ-сводки: кто и когда менял или запускал"
      />
      {audit.isError ? (
        <ErrorState
          title="Не удалось загрузить журнал"
          description={errorText(audit.error, 'Попробуйте ещё раз.')}
          onRetry={() => void audit.refetch()}
          retrying={audit.isFetching}
        />
      ) : (
        <LoadingOverlay loading={audit.isPlaceholderData}>
          <Card padding="none">
            <Table
              caption="Журнал"
              columns={COLUMNS}
              rows={audit.data?.items ?? []}
              rowKey={(entry) => entry.id}
              loading={audit.isPending}
              empty={{ icon: 'history', title: 'Записей пока нет' }}
            />
            {audit.data && (
              <Pagination
                page={page}
                size={DEFAULT_PAGE_SIZE}
                total={audit.data.total}
                onChange={(next) =>
                  setParams(next > 0 ? { page: String(next) } : {}, { replace: false })
                }
              />
            )}
          </Card>
        </LoadingOverlay>
      )}
    </>
  );
}
