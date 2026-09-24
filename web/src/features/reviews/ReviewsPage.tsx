import { errorText } from '../../api/errors';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ErrorState,
  formatDateTime,
  formatNumber,
  PageHeader,
  Skeleton,
  Stat,
  useToast,
} from '../../ui';
import { useReviewsSync, useStartReviewsSync } from './api';
import { OUTCOMES } from './labels';
import styles from './ReviewsPage.module.css';
import type { ReviewsSyncStatus } from './types';

export function ReviewsPage() {
  return (
    <>
      <PageHeader title="Отзывы" description="Отзывы из проекта Reviews" />
      <SyncCard />
    </>
  );
}

function SyncCard() {
  const sync = useReviewsSync();
  return (
    <Card as="section" variant="outlined" padding="large" aria-label="Синхронизация">
      <CardHeader title="Синхронизация" actions={sync.data && <StartButton status={sync.data} />} />
      {sync.isPending ? (
        <div className={styles.body} role="status" aria-label="Загружаем синхронизацию">
          <Skeleton height={24} width={200} />
          <div className={styles.tiles}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} height={108} className={styles.skeleton} />
            ))}
          </div>
        </div>
      ) : sync.isError ? (
        <ErrorState
          compact
          title="Не удалось загрузить синхронизацию"
          description={errorText(sync.error, 'Попробуйте ещё раз.')}
          onRetry={() => void sync.refetch()}
          retrying={sync.isFetching}
        />
      ) : (
        <SyncView status={sync.data} />
      )}
    </Card>
  );
}

function StartButton({ status }: { status: ReviewsSyncStatus }) {
  const toast = useToast();
  const start = useStartReviewsSync();
  const submit = () =>
    start.mutate(undefined, {
      onError: (error) =>
        toast.show({
          message: errorText(error, 'Не удалось запустить синхронизацию', {
            business_rule_violation: 'Синхронизация уже идёт',
          }),
          tone: 'error',
        }),
    });
  return (
    <Button
      icon="sync"
      loading={status.running || start.isPending}
      disabled={!status.enabled}
      onClick={submit}
    >
      Синхронизировать
    </Button>
  );
}

function SyncState({ status }: { status: ReviewsSyncStatus }) {
  if (!status.enabled) return <Badge icon="sync_disabled">Выключена на сервере</Badge>;
  if (status.running) {
    return (
      <Badge tone="info" icon="sync">
        Идёт синхронизация
      </Badge>
    );
  }
  if (!status.lastOutcome) return <Badge>Ещё не запускалась</Badge>;
  const outcome = OUTCOMES[status.lastOutcome];
  return <Badge tone={outcome.tone}>{outcome.label}</Badge>;
}

function SyncView({ status }: { status: ReviewsSyncStatus }) {
  return (
    <div className={styles.body}>
      <p className={styles.state}>
        <SyncState status={status} />
        {status.lastCheckedAt && <span>Проверено {formatDateTime(status.lastCheckedAt)}</span>}
        {status.lastChangedAt && <span>Изменения {formatDateTime(status.lastChangedAt)}</span>}
      </p>
      {status.lastOutcome === 'FAILED' && status.lastError && (
        <code className={styles.error}>{status.lastError}</code>
      )}
      <div className={styles.tiles}>
        <Stat icon="reviews" label="Отзывов" value={formatNumber(status.reviewsActive)} />
        <Stat icon="delete" label="Удалено" value={formatNumber(status.reviewsRemoved)} />
        <Stat icon="school" label="Преподавателей" value={formatNumber(status.teachersActive)} />
      </div>
      {status.lastChangedAt && (
        <p className={styles.muted}>
          Последний запуск: +{formatNumber(status.lastAdded)}, изменено{' '}
          {formatNumber(status.lastUpdated)}, удалено {formatNumber(status.lastRemoved)}
        </p>
      )}
    </div>
  );
}
