import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useApiMutation, type Resource } from '../../lib/data';
import { counted, formatDate, formatDateTime, formatNumber } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { Mono } from '../../lib/Mono';
import { Panel } from '../../lib/Panel';
import { Stat, Stats } from '../../lib/Stats';
import { AUDIT_PREFIX, startSummaries, SUMMARIES_PATH } from './api';
import { RUN_OUTCOMES, RUN_TRIGGERS, type Health } from './labels';
import { RunState } from './parts';
import type { AiSummariesState } from './types';

const TEACHERS = ['преподаватель', 'преподавателя', 'преподавателей'] as const;

function healthOf(state: AiSummariesState): Health {
  if (!state.enabled) return { tone: 'neutral', label: 'Выключены на сервере' };
  if (state.running) return { tone: 'accent', label: 'Идёт пересчёт' };
  if (!state.lastOutcome) return { tone: 'neutral', label: 'Ещё не запускался' };
  return RUN_OUTCOMES[state.lastOutcome];
}

/**
 * The nightly run of AI summaries and its manual start. A run builds the queue (teachers whose
 * reviews changed), not every summary, so the button is named by the queue. The page re-reads the
 * state while a run goes.
 */
export function SummariesCard({ summaries }: { summaries: Resource<AiSummariesState> }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const start = useApiMutation({
    run: startSummaries,
    forgets: [SUMMARIES_PATH, AUDIT_PREFIX],
    failed: 'Не удалось запустить пересчёт',
    errors: { business_rule_violation: 'Пересчёт уже идёт' },
  });
  const state = summaries.data;
  const remaining = state ? Math.max(0, state.dailyBudget - state.budgetUsed) : 0;

  return (
    <>
      <Panel
        body="content"
        title="ИИ-сводки"
        hint={
          state?.model
            ? `Gemini · ${state.model}; пересчитываются каждый день в 05:30`
            : 'Пересчитываются каждый день в 05:30'
        }
        action={
          state ? (
            <Button
              label="Пересчитать очередь"
              size="sm"
              isDisabled={!state.enabled || state.keyStatus === 'MISSING' || state.running}
              isLoading={start.isPending}
              onClick={() => setIsConfirming(true)}
            />
          ) : null
        }
      >
        <Loadable
          resource={summaries}
          label="Загружаем сводки"
          errorTitle="Не удалось загрузить сводки"
          isCompact
        >
          {(data) => <Summaries state={data} />}
        </Loadable>
      </Panel>
      <AlertDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        title="Пересчитать очередь?"
        description={`В очереди ${counted(state?.pending ?? 0, TEACHERS)}: у них изменились отзывы. Готовые сводки остальных не пересчитываются. Осталось запросов сегодня: ${formatNumber(remaining)}.`}
        actionLabel="Пересчитать"
        cancelLabel="Отмена"
        actionVariant="primary"
        onAction={() => {
          setIsConfirming(false);
          // A refused start means the state on screen is old: a run is going, or summaries were turned off.
          start.mutate(undefined, { onError: summaries.reload });
        }}
      />
    </>
  );
}

function Summaries({ state }: { state: AiSummariesState }) {
  const hasFailed = state.lastOutcome !== null && state.lastOutcome !== 'COMPLETED';
  const isKeyBroken = state.keyStatus === 'FAILED' || state.keyStatus === 'EXPIRED';
  return (
    <VStack gap={4}>
      <RunState health={healthOf(state)} isRunning={state.enabled && state.running}>
        {state.lastStartedAt ? (
          <Text type="supporting" color="secondary">
            Запуск {formatDateTime(state.lastStartedAt)}
            {state.lastTrigger ? ` · ${RUN_TRIGGERS[state.lastTrigger]}` : ''}
          </Text>
        ) : null}
      </RunState>
      {!state.running && hasFailed && state.lastError ? (
        <Mono tone="error">{state.lastError}</Mono>
      ) : null}
      {state.keyStatus === 'MISSING' || isKeyBroken ? (
        <Banner
          status={isKeyBroken ? 'error' : 'warning'}
          icon={<KeyRound size={18} />}
          title={isKeyBroken ? 'Ключ Gemini не принят' : 'Ключ Gemini не задан'}
          description="Без рабочего ключа сводки не строятся"
          endContent={
            <Button label="Ключи и доступы" href="/admin/system" variant="secondary" size="sm" />
          }
        />
      ) : null}
      <Stats>
        <Stat label="Готовы" value={formatNumber(state.ready)} />
        <Stat label="В очереди" value={formatNumber(state.pending)} />
        <Stat label="Ошибки" value={formatNumber(state.failed)} />
        <Stat label="Скрыты" value={formatNumber(state.hidden)} />
        <Stat
          label={`Запросов за ${formatDate(state.budgetDay)}`}
          value={`${formatNumber(state.budgetUsed)} из ${formatNumber(state.dailyBudget)}`}
        />
      </Stats>
      {state.lastFinishedAt ? (
        <Text type="supporting" color="secondary">
          Последний запуск: построено {formatNumber(state.lastGenerated)}, отклонено{' '}
          {formatNumber(state.lastFailed)}, запросов {formatNumber(state.lastRequests)}
        </Text>
      ) : null}
    </VStack>
  );
}
