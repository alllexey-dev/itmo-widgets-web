import { useState } from 'react';
import { Link } from 'react-router';
import { errorText } from '../../api/errors';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  formatDate,
  formatDateTime,
  formatNumber,
  Icon,
  Skeleton,
  Stat,
  useToast,
} from '../../ui';
import { useAiSummaries, useReloadTeachersAfterRun, useStartAiSummaries } from './api';
import { SUMMARY_OUTCOMES } from './labels';
import styles from './ReviewsPage.module.css';
import type { AiSummariesState } from './types';

const TRIGGERS = { SCHEDULE: 'по расписанию', ADMIN: 'администратором' } as const;

export function SummariesCard() {
  const summaries = useAiSummaries();
  useReloadTeachersAfterRun(summaries.data?.running);
  const model = summaries.data?.model;
  return (
    <Card as="section" variant="outlined" padding="large" aria-label="ИИ-сводки">
      <CardHeader
        title="ИИ-сводки"
        subtitle={model && `Gemini · ${model}`}
        actions={summaries.data && <StartButton state={summaries.data} />}
      />
      {summaries.isPending ? (
        <div className={styles.body} role="status" aria-label="Загружаем сводки">
          <Skeleton height={24} width={200} />
          <div className={styles.tiles}>
            {[0, 1, 2, 3, 4].map((index) => (
              <Skeleton key={index} height={108} className={styles.skeleton} />
            ))}
          </div>
        </div>
      ) : summaries.isError ? (
        <ErrorState
          compact
          title="Не удалось загрузить сводки"
          description={errorText(summaries.error, 'Попробуйте ещё раз.')}
          onRetry={() => void summaries.refetch()}
          retrying={summaries.isFetching}
        />
      ) : (
        <SummariesView state={summaries.data} />
      )}
    </Card>
  );
}

function remaining(state: AiSummariesState): number {
  return Math.max(0, state.dailyBudget - state.budgetUsed);
}

function StartButton({ state }: { state: AiSummariesState }) {
  const toast = useToast();
  const start = useStartAiSummaries();
  const [confirming, setConfirming] = useState(false);
  const submit = () =>
    start.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onError: (error) => {
        setConfirming(false);
        toast.show({
          message: errorText(error, 'Не удалось запустить пересчёт', {
            business_rule_violation: 'Пересчёт уже идёт',
          }),
          tone: 'error',
        });
      },
    });
  return (
    <>
      <Button
        icon="auto_awesome"
        loading={state.running || (start.isPending && !confirming)}
        disabled={!state.enabled || state.keyStatus === 'MISSING'}
        onClick={() => setConfirming(true)}
      >
        Пересчитать всё
      </Button>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        loading={start.isPending}
        title="Пересчитать сводки?"
        description={`Только преподаватели с изменившимися отзывами. Осталось запросов сегодня: ${formatNumber(remaining(state))}.`}
        confirmLabel="Пересчитать"
      />
    </>
  );
}

function RunState({ state }: { state: AiSummariesState }) {
  if (!state.enabled) return <Badge icon="block">Выключены на сервере</Badge>;
  if (state.running) {
    return (
      <Badge tone="info" icon="auto_awesome">
        Идёт пересчёт
      </Badge>
    );
  }
  if (!state.lastOutcome) return <Badge>Ещё не запускался</Badge>;
  const outcome = SUMMARY_OUTCOMES[state.lastOutcome];
  return <Badge tone={outcome.tone}>{outcome.label}</Badge>;
}

function KeyNotice({ state }: { state: AiSummariesState }) {
  const failed = state.keyStatus === 'FAILED' || state.keyStatus === 'EXPIRED';
  if (state.keyStatus !== 'MISSING' && !failed) return null;
  return (
    <p className={styles.notice}>
      <Icon name="key" size={20} />
      <span>{failed ? 'Ключ не принят' : 'Ключ Gemini не задан'}</span>
      <Link to="/admin/system">Учётные данные</Link>
    </p>
  );
}

function SummariesView({ state }: { state: AiSummariesState }) {
  const failed = state.lastOutcome !== null && state.lastOutcome !== 'COMPLETED';
  return (
    <div className={styles.body}>
      <p className={styles.state}>
        <RunState state={state} />
        {state.lastStartedAt && (
          <span>
            Запуск {formatDateTime(state.lastStartedAt)}
            {state.lastTrigger && ` · ${TRIGGERS[state.lastTrigger]}`}
          </span>
        )}
      </p>
      {!state.running && failed && state.lastError && (
        <code className={styles.error}>{state.lastError}</code>
      )}
      <KeyNotice state={state} />
      <div className={styles.tiles}>
        <Stat icon="check_circle" label="Готовы" value={formatNumber(state.ready)} />
        <Stat icon="schedule" label="В очереди" value={formatNumber(state.pending)} />
        <Stat icon="error" label="Ошибки" value={formatNumber(state.failed)} />
        <Stat icon="visibility_off" label="Скрыты" value={formatNumber(state.hidden)} />
        <Stat
          icon="data_usage"
          label="Запросов сегодня"
          value={`${formatNumber(state.budgetUsed)} из ${formatNumber(state.dailyBudget)}`}
          caption={formatDate(state.budgetDay)}
        />
      </div>
      {state.lastFinishedAt && (
        <p className={styles.muted}>
          Последний запуск: построено {formatNumber(state.lastGenerated)}, отклонено{' '}
          {formatNumber(state.lastFailed)}, запросов {formatNumber(state.lastRequests)}
        </p>
      )}
    </div>
  );
}
