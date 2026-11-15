import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { RefreshCw } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { formatDateTime, formatNumber } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { Mono } from '../../lib/Mono';
import { Panel } from '../../lib/Panel';
import { Stat, Stats } from '../../lib/Stats';
import { AUDIT_PREFIX, startSync, SYNC_PATH, whileRunning } from './api';
import { SYNC_NAME, SYNC_OUTCOMES, SYNC_RUNNING, type Health } from './labels';
import { RunState } from './parts';
import type { ReviewsSyncStatus } from './types';

function healthOf(status: ReviewsSyncStatus): Health {
  if (!status.enabled) return { tone: 'neutral', label: 'Выключена на сервере' };
  if (status.running) return { tone: 'accent', label: SYNC_RUNNING };
  if (!status.lastOutcome) return { tone: 'neutral', label: 'Ещё не запускалась' };
  return SYNC_OUTCOMES[status.lastOutcome];
}

/** The copy of teacher reviews from the Reviews project; re-read quietly while a run goes. */
export function SyncCard() {
  const sync = useApiQuery<ReviewsSyncStatus>(SYNC_PATH, undefined, { poll: whileRunning });
  const start = useApiMutation({
    run: startSync,
    forgets: [SYNC_PATH, AUDIT_PREFIX],
    failed: 'Не удалось запустить синхронизацию',
    errors: { business_rule_violation: 'Синхронизация уже идёт' },
  });

  return (
    <Panel
      body="content"
      title={SYNC_NAME}
      hint="Копия отзывов из проекта Reviews; сама обновляется каждый день в 05:00"
      action={
        sync.data ? (
          <Button
            label="Синхронизировать"
            icon={<RefreshCw size={16} />}
            size="sm"
            isDisabled={!sync.data.enabled || sync.data.running}
            isLoading={start.isPending}
            // A refused start means the state on screen is old: a run is going, or sync was turned off.
            onClick={() => start.mutate(undefined, { onError: sync.reload })}
          />
        ) : null
      }
    >
      <Loadable
        resource={sync}
        label="Загружаем синхронизацию"
        errorTitle="Не удалось загрузить синхронизацию"
        isCompact
      >
        {(status) => (
          <VStack gap={4}>
            <RunState health={healthOf(status)} isRunning={status.enabled && status.running}>
              {status.lastCheckedAt ? (
                <Text type="supporting" color="secondary">
                  Проверено {formatDateTime(status.lastCheckedAt)}
                </Text>
              ) : null}
              {status.lastChangedAt ? (
                <Text type="supporting" color="secondary">
                  Изменения {formatDateTime(status.lastChangedAt)}
                </Text>
              ) : null}
            </RunState>
            {status.lastOutcome === 'FAILED' && status.lastError ? (
              <Mono tone="error">{status.lastError}</Mono>
            ) : null}
            <Stats>
              <Stat label="Отзывов" value={formatNumber(status.reviewsActive)} />
              <Stat label="Удалено" value={formatNumber(status.reviewsRemoved)} />
              <Stat label="Преподавателей" value={formatNumber(status.teachersActive)} />
            </Stats>
            {status.lastChangedAt ? (
              <Text type="supporting" color="secondary">
                Последний запуск с изменениями: добавлено {formatNumber(status.lastAdded)}, изменено{' '}
                {formatNumber(status.lastUpdated)}, удалено {formatNumber(status.lastRemoved)}
              </Text>
            ) : null}
          </VStack>
        )}
      </Loadable>
    </Panel>
  );
}
