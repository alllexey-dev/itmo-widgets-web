import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Dumbbell, History, Repeat } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApiMutation, useApiQuery, useResource } from '../../lib/data';
import { formatDay } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { LoadError } from '../../lib/LoadError';
import { PageHeader } from '../../lib/PageHeader';
import { Panel } from '../../lib/Panel';
import { SPORT_KIND_HINT, SPORT_KIND_LABEL, type SportKind } from '../../lib/sportLabels';
import { leaveQueue, LIMITS_PATH, SPORT_PREFIX, sportOverview } from './api';
import {
  activeEntries,
  dateStatus,
  formatLessonTime,
  KIND_ICON,
  kindOf,
  leavingText,
  lessonOf,
  limitView,
  pastEntries,
  sectionEntryIds,
  sectionPlace,
  sectionSlot,
  statusOf,
  upcomingDates,
} from './labels';
import './sport.css';
import type { AutoSignLimits, QueueEntry, SportSection } from './types';

const RECENT = 5;
const KINDS: readonly SportKind[] = ['auto', 'free', 'section'];

/** A sentence that continues another one after a dash starts with a small letter. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function entryKey(entry: QueueEntry): string {
  return `${entry.type}-${entry.id}`;
}

/**
 * One queue entry: the section, when, where the entry stands and how it was made; "Выйти" while it
 * can be left. An entry whose place is being taken says what goes on and what to do.
 */
function EntryRow({
  entry,
  kind,
  onLeave,
}: {
  entry: QueueEntry;
  kind: SportKind;
  onLeave?: (entry: QueueEntry) => void;
}) {
  const lesson = lessonOf(entry);
  const status = statusOf(entry);
  return (
    <li className="sport-entry">
      <IconTile icon={KIND_ICON[kind]} tone={status.isUrgent ? 'accent' : undefined} />
      <span className="sport-entry-body">
        <span className="sport-entry-text">
          <Text display="block">{lesson.section}</Text>
          <Text type="supporting" color="secondary" display="block">
            {formatLessonTime(lesson)}
          </Text>
          <Text
            type="supporting"
            color={status.isUrgent ? 'primary' : 'secondary'}
            weight={status.isUrgent ? 'medium' : undefined}
            display="block"
          >
            {status.text}
          </Text>
          {status.hint ? (
            <Text type="supporting" color="secondary" display="block">
              {status.hint}
            </Text>
          ) : null}
        </span>
        <Token label={SPORT_KIND_LABEL[kind]} size="sm" />
      </span>
      {onLeave ? (
        <Button
          label="Выйти"
          aria-label={`Выйти из очереди: ${lesson.section}`}
          variant="ghost"
          size="sm"
          onClick={() => onLeave(entry)}
        />
      ) : null}
    </li>
  );
}

/** A section: its slot, the user's place in it and what happens with its next dates. */
function SectionRow({ section, entries }: { section: SportSection; entries: QueueEntry[] }) {
  const dates = upcomingDates(section);
  return (
    <li className="sport-entry">
      <IconTile icon={Repeat} />
      <span className="sport-entry-text">
        <Text display="block">{section.lesson.sectionName}</Text>
        <Text type="supporting" color="secondary" display="block">
          {sectionSlot(section)}
        </Text>
        <Text type="supporting" color="secondary" display="block">
          {sectionPlace(section)}
        </Text>
        {dates.length > 0 ? (
          <ul className="sport-dates" aria-label={`Даты секции: ${section.lesson.sectionName}`}>
            {dates.map((date) => (
              <li key={date.start}>
                <Text type="supporting" color="secondary">
                  {formatDay(date.start)} — {dateStatus(date, entries)}
                </Text>
              </li>
            ))}
          </ul>
        ) : (
          <Text type="supporting" color="secondary" display="block">
            Ждём расписание следующих занятий
          </Text>
        )}
      </span>
    </li>
  );
}

function Limits({ limits }: { limits: AutoSignLimits }) {
  const view = limitView(limits);
  return (
    <>
      <ProgressBar
        label={view.label}
        value={view.used}
        max={Math.max(1, limits.limit)}
        hasValueLabel
        formatValueLabel={() => view.rest}
        variant={view.full ? 'warning' : 'accent'}
      />
      {view.full ? <Text>{view.full}</Text> : null}
      <Text type="supporting" color="secondary">
        В лимит входят автозаписи, которые ждут, и те, по которым за последние 30 дней была попытка
        записи. Каждая дата секции — тоже автозапись. Очереди на место лимит не тратят.
      </Text>
    </>
  );
}

/** A line of supporting text at the bottom of a panel of rows, in line with the rows' text. */
function PanelNote({ children }: { children: ReactNode }) {
  return (
    <VStack gap={1} paddingInline={3} paddingBlock={2}>
      {children}
    </VStack>
  );
}

/**
 * The user's own sport: the queues they wait in, their sections, the auto-sign limit and the
 * queues that ended. Getting into a queue or making a section needs the lesson list of My ITMO,
 * so it stays in the app; here the user sees it all and leaves a queue.
 */
export default function SportPage() {
  const overview = useResource(sportOverview);
  const limits = useApiQuery<AutoSignLimits>(LIMITS_PATH);
  const hasFailed = overview.data === undefined && Boolean(overview.error) && !overview.loading;
  const sectionEntries = sectionEntryIds(overview.data?.sections ?? []);

  // The entry stays while the dialog closes, so its text does not vanish mid-animation.
  const [leaving, setLeaving] = useState<QueueEntry | null>(null);
  const [isConfirming, setConfirming] = useState(false);
  const leave = useApiMutation({
    run: leaveQueue,
    forgets: [SPORT_PREFIX],
    done: 'Вы вышли из очереди',
    failed: 'Не удалось выйти из очереди',
  });

  return (
    <VStack gap={6}>
      <PageHeader
        title="Спорт"
        text="Ваши очереди, автозаписи и секции. Встать в очередь или сделать занятие секцией можно в приложении."
      />

      <div className="sport-columns">
        <VStack gap={6}>
          <Panel title="В очереди" hint="Занятия, на которые вы ждёте записи">
            <Loadable
              resource={overview}
              label="Загружаем очереди"
              errorTitle="Не удалось загрузить очереди"
              isCompact
            >
              {({ entries }) => {
                const active = activeEntries(entries);
                if (active.length === 0) {
                  return (
                    <EmptyState
                      icon={<Dumbbell size={32} />}
                      title="Вы не стоите в очередях"
                      description="Встаньте в очередь на занятие или включите автозапись в приложении — они появятся здесь."
                      headingLevel={3}
                      isCompact
                    />
                  );
                }
                const kinds = new Set(active.map((entry) => kindOf(entry, sectionEntries)));
                return (
                  <>
                    <ul className="sport-list" aria-label="Очереди">
                      {active.map((entry) => (
                        <EntryRow
                          key={entryKey(entry)}
                          entry={entry}
                          kind={kindOf(entry, sectionEntries)}
                          onLeave={(target) => {
                            setLeaving(target);
                            setConfirming(true);
                          }}
                        />
                      ))}
                    </ul>
                    <PanelNote>
                      {KINDS.filter((kind) => kinds.has(kind)).map((kind) => (
                        <Text key={kind} type="supporting" color="secondary">
                          {SPORT_KIND_LABEL[kind]} — {lowerFirst(SPORT_KIND_HINT[kind])}.
                        </Text>
                      ))}
                      <Text type="supporting" color="secondary">
                        Записывает всегда телефон с приложением: сервер будит его, когда подходит
                        ваша очередь. Телефон должен быть в сети.
                      </Text>
                    </PanelNote>
                  </>
                );
              }}
            </Loadable>
          </Panel>

          <Panel
            title="Секции"
            hint="Занятия раз в две недели: в очередь на каждую дату ставим вас автоматически"
          >
            {hasFailed ? (
              // The queues panel already offers the retry of this request.
              <PanelNote>
                <Text color="secondary">Не удалось загрузить</Text>
              </PanelNote>
            ) : (
              <Loadable resource={overview} label="Загружаем секции" isCompact>
                {({ entries, sections }) => {
                  if (sections === null) {
                    return (
                      <LoadError
                        error={null}
                        title="Не удалось загрузить секции"
                        onRetry={overview.reload}
                        isCompact
                      />
                    );
                  }
                  if (sections.length === 0) {
                    return (
                      <EmptyState
                        icon={<Repeat size={32} />}
                        title="Секций нет"
                        description="Занятие, на которое вы записаны, можно сделать секцией в приложении: тогда в очередь на него раз в две недели ставим вас автоматически."
                        headingLevel={3}
                        isCompact
                      />
                    );
                  }
                  return (
                    <>
                      <ul className="sport-list" aria-label="Секции">
                        {sections.map((section) => (
                          <SectionRow key={section.id} section={section} entries={entries} />
                        ))}
                      </ul>
                      <PanelNote>
                        <Text type="supporting" color="secondary">
                          Место в секции — ваш порядок среди тех, кто сделал это занятие секцией: в
                          этом порядке ставим в очередь на каждую дату. Место в очереди — уже на
                          конкретную дату, вместе с теми, кто встал в неё вручную.
                        </Text>
                        <Text type="supporting" color="secondary">
                          Пропустить дату или выключить секцию можно в приложении.
                        </Text>
                      </PanelNote>
                    </>
                  );
                }}
              </Loadable>
            )}
          </Panel>
        </VStack>

        <VStack gap={6}>
          <Panel
            title="Лимит автозаписи"
            hint="Сколько автозаписей можно держать одновременно"
            body="content"
          >
            <Loadable
              resource={limits}
              label="Загружаем лимит"
              errorTitle="Не удалось загрузить лимит"
              isCompact
            >
              {(data) => <Limits limits={data} />}
            </Loadable>
          </Panel>

          <Panel title="Недавние" hint="Последние очереди, которые закончились">
            {hasFailed ? (
              // The queues panel already offers the retry of this request.
              <PanelNote>
                <Text color="secondary">Не удалось загрузить</Text>
              </PanelNote>
            ) : (
              <Loadable resource={overview} label="Загружаем недавние очереди" isCompact>
                {({ entries }) => {
                  const recent = pastEntries(entries, RECENT);
                  if (recent.length === 0) {
                    return (
                      <EmptyState
                        icon={<History size={32} />}
                        title="Недавних очередей нет"
                        description="Здесь появятся очереди, которые закончились."
                        headingLevel={3}
                        isCompact
                      />
                    );
                  }
                  return (
                    <ul className="sport-list" aria-label="Недавние очереди">
                      {recent.map((entry) => (
                        <EntryRow
                          key={entryKey(entry)}
                          entry={entry}
                          kind={kindOf(entry, sectionEntries)}
                        />
                      ))}
                    </ul>
                  );
                }}
              </Loadable>
            )}
          </Panel>
        </VStack>
      </div>

      <AlertDialog
        isOpen={isConfirming}
        onOpenChange={setConfirming}
        title="Выйти из очереди?"
        description={leaving ? leavingText(lessonOf(leaving), kindOf(leaving, sectionEntries)) : ''}
        actionLabel="Выйти"
        isActionLoading={leave.isPending}
        onAction={() => {
          if (!leaving) return;
          void leave
            .mutateAsync(leaving)
            // The mutation shows the failure itself.
            .catch(() => undefined)
            .finally(() => setConfirming(false));
        }}
      />
    </VStack>
  );
}
