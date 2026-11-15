import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { CalendarClock } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { formatDateTime, formatDuration, formatNumber, formatRelative } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import {
  SPORT_OUTCOME_LABEL,
  SPORT_OUTCOME_TONE,
  SPORT_RUNS_LABEL,
  SPORT_WAITING_LABEL,
} from '../../lib/metricLabels';
import { Panel } from '../../lib/Panel';
import { Stat, Stats } from '../../lib/Stats';
import { AUDIT_PREFIX, saveSportSettings, SPORT_PATH, SPORT_SETTINGS_PATH } from './api';
import { SPORT_ERRORS, SPORT_HEALTH } from './labels';
import { Origin, State } from './parts';
import type { SportErrorCategory, SportRun, SportSettings, SportStatus } from './types';

const SHOWN_RUNS = 5;
const MAX_LIMIT = 100;

/**
 * Спорт: the catalogue refresh of sport lessons, the entries waiting for auto-enrolment and every
 * user's monthly limit. The limit loads apart from the status, so a failure of one keeps the other.
 */
export function SportTab() {
  const sport = useApiQuery<SportStatus>(SPORT_PATH);
  const settings = useApiQuery<SportSettings>(SPORT_SETTINGS_PATH);
  const [showsAll, setShowsAll] = useState(false);
  const latest = sport.data?.runs[0];
  const runs = sport.data?.runs ?? [];

  return (
    <>
      <Panel
        body="content"
        title="Автозапись на спорт"
        hint="Обновление каталога занятий и записи, которые ждут места"
        action={
          sport.data ? (
            latest ? (
              <State
                tone={SPORT_OUTCOME_TONE[latest.outcome]}
                label={SPORT_HEALTH[latest.outcome]}
              />
            ) : (
              <State tone="neutral" label="Запусков не было" />
            )
          ) : null
        }
      >
        <Loadable
          resource={sport}
          label="Загружаем автозапись"
          errorTitle="Не удалось загрузить автозапись"
          isCompact
        >
          {(status) => <Week status={status} />}
        </Loadable>
      </Panel>
      <div className="system-columns">
        <Panel
          title="Запуски"
          action={
            runs.length > SHOWN_RUNS ? (
              <Button
                label={showsAll ? 'Свернуть' : `Все (${runs.length})`}
                variant="ghost"
                size="sm"
                onClick={() => setShowsAll(!showsAll)}
              />
            ) : null
          }
        >
          <Loadable
            resource={sport}
            label="Загружаем запуски"
            errorTitle="Не удалось загрузить запуски"
            isCompact
          >
            {(status) =>
              status.runs.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock size={32} />}
                  title="Запусков ещё не было"
                  description="Каталог занятий обновляется по расписанию; первый запуск появится здесь"
                  headingLevel={3}
                  isCompact
                />
              ) : (
                <List aria-label="Последние запуски">
                  {(showsAll ? status.runs : status.runs.slice(0, SHOWN_RUNS)).map((run) => (
                    <ListItem
                      key={run.id}
                      startContent={
                        <StatusDot
                          variant={SPORT_OUTCOME_TONE[run.outcome]}
                          label={SPORT_OUTCOME_LABEL[run.outcome]}
                        />
                      }
                      label={formatDateTime(run.timestamp)}
                      description={runText(run)}
                      endContent={
                        <Text type="supporting" color="secondary" hasTabularNumbers>
                          {formatDuration(run.durationMillis)}
                        </Text>
                      }
                    />
                  ))}
                </List>
              )
            }
          </Loadable>
        </Panel>
        <Panel
          body="content"
          title="Лимит автозаписи"
          hint="Один для всех; новое значение действует сразу"
        >
          <Loadable
            resource={settings}
            label="Загружаем лимит"
            errorTitle="Не удалось загрузить лимит"
            isCompact
          >
            {(saved) => (
              // The form starts over when the saved value changes.
              <LimitForm
                key={`${saved.autoSignLimit}:${saved.updatedAt ?? 'default'}`}
                saved={saved}
              />
            )}
          </Loadable>
        </Panel>
      </div>
    </>
  );
}

function runText(run: SportRun): string {
  if (run.errorCategory) return `Ошибка: ${SPORT_ERRORS[run.errorCategory]}`;
  return `Получено ${formatNumber(run.receivedLessons)}, новых ${formatNumber(run.newLessonsAdded)}, изменено ${formatNumber(run.updatedLessons)}`;
}

/**
 * The week of the catalogue refresh and who waits now. Failed and partial runs are two figures and
 * are never added up; what stopped them is one line under the figures.
 */
function Week({ status }: { status: SportStatus }) {
  const count = (value: number | undefined) => value ?? 0;
  const failed = count(status.outcomes7d.FAILED);
  const partial = count(status.outcomes7d.PARTIAL);
  const runs = count(status.outcomes7d.SUCCESS) + partial + failed;
  const causes = (Object.keys(SPORT_ERRORS) as SportErrorCategory[])
    .map((category) => ({ category, count: count(status.errors7d[category]) }))
    .filter((cause) => cause.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <VStack gap={4}>
      <Stats isWide>
        <Stat
          label="Последний успех"
          value={status.lastSuccessAt ? formatRelative(status.lastSuccessAt) : 'Не было'}
          note={status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : undefined}
        />
        <Stat
          label="Запусков за 7 дней"
          value={formatNumber(runs)}
          note={
            status.averageDurationMillis7d === null
              ? undefined
              : `в среднем ${formatDuration(status.averageDurationMillis7d)}`
          }
        />
        <Stat label={SPORT_RUNS_LABEL.failed} value={formatNumber(failed)} note="за 7 дней" />
        <Stat label={SPORT_RUNS_LABEL.partial} value={formatNumber(partial)} note="за 7 дней" />
        <Stat
          label={SPORT_WAITING_LABEL.auto}
          value={formatNumber(status.activeAutoSignEntries)}
          note="ждут сейчас"
        />
        <Stat
          label={SPORT_WAITING_LABEL.free}
          value={formatNumber(status.activeFreeSignEntries)}
          note="ждут сейчас"
        />
      </Stats>
      {causes.length > 0 ? (
        <Text type="supporting" color="secondary">
          Причины за 7 дней:{' '}
          {causes
            .map((cause) => `${SPORT_ERRORS[cause.category].toLowerCase()} — ${cause.count}`)
            .join(', ')}
        </Text>
      ) : null}
    </VStack>
  );
}

function LimitForm({ saved }: { saved: SportSettings }) {
  const [value, setValue] = useState(String(saved.autoSignLimit));
  const [isConfirming, setIsConfirming] = useState(false);

  const limit = /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  const isValid = Number.isInteger(limit) && limit <= MAX_LIMIT;
  const isDirty = limit !== saved.autoSignLimit;

  const save = useApiMutation({
    run: () => saveSportSettings({ autoSignLimit: limit }),
    forgets: [SPORT_SETTINGS_PATH, AUDIT_PREFIX],
    done: 'Лимит сохранён',
    failed: 'Не удалось сохранить лимит',
    errors: {
      invalid_request_data: `Лимит — от 0 до ${MAX_LIMIT}`,
      invalid_request: `Лимит — от 0 до ${MAX_LIMIT}`,
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isDirty || !isValid || save.isPending) return;
    // Zero stops new entries for everybody, so it asks first.
    if (limit === 0) setIsConfirming(true);
    else save.mutate();
  }

  return (
    <>
      <form className="system-form" onSubmit={submit} noValidate>
        <TextInput
          label="Лимит автозаписи в месяц"
          description="Для каждого за 30 дней, 0 — новые записи выключены"
          value={value}
          onChange={setValue}
          status={isValid ? undefined : { type: 'error', message: `От 0 до ${MAX_LIMIT}` }}
          inputMode="numeric"
          autoComplete="off"
          hasSpellCheck={false}
          width={220}
        />
        <Origin overridden={saved.overridden} updatedAt={saved.updatedAt} />
        <HStack gap={2}>
          <Button
            label="Сохранить"
            variant="primary"
            type="submit"
            isDisabled={!isDirty}
            isLoading={save.isPending}
          />
        </HStack>
      </form>
      <AlertDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        title="Выключить новые автозаписи?"
        description="С лимитом 0 никто не сможет поставить новую автозапись, пока лимит не поднимут. Это применится сразу ко всем."
        actionLabel="Выключить"
        cancelLabel="Отмена"
        actionVariant="destructive"
        onAction={() => {
          setIsConfirming(false);
          save.mutate();
        }}
      />
    </>
  );
}
