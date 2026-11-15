// The reviews and moderation tab: what waits for a moderator, how fast cases are decided, and the
// state of the reviews base.

import { VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

import { formatRelative } from '../../lib/format';
import {
  SAMPLE_SIZE,
  useActiveRestrictions,
  useModerationStats,
  useOpenCases,
  useResolvedCases,
  useReviewsSync,
  useSummaries,
  useVerification,
} from './api';
import { Meter, SegmentBar, TimeChart } from './charts';
import { formatInt, formatPct, formatSpan } from './format';
import { METRICS } from './metrics';
import { PeriodControl, usePeriod } from './period';
import {
  actorSegments,
  backlogOf,
  casesFlowChart,
  decisionSegments,
  reportSegments,
  reportTotals,
  reviewsChart,
  stepOf,
  votesChart,
} from './periodModel';
import { REVIEW_CHECK_NAME, SYNC_NAME } from '../../lib/metricLabels';
import { SYNC_OUTCOMES } from './labels';
import {
  capabilitySegments,
  decisionTimes,
  median,
  reasonSegments,
  summarySegments,
  targetSegments,
  verificationSegments,
} from './model';
import {
  Facts,
  Nothing,
  SourcePanel,
  StatusLine,
  SubHeading,
  TabFrame,
  TileGrid,
  Tiles,
  type TileView,
} from './parts';
import type { CasesPage, RestrictionsPage } from './types';

/** Says when a breakdown covers a part of the list: the totals are exact, the split is a sample. */
function sampleNote(shown: number, total: number, what: string): string | null {
  return total > shown ? `Разбивка по ${formatInt(shown)} ${what} из ${formatInt(total)}` : null;
}

function openTiles(page: CasesPage): TileView[] {
  const oldest = page.items[0];
  return [
    {
      label: 'Открытые заявки',
      hint: 'Заявки модерации, по которым ещё нет решения',
      value: formatInt(page.total),
      note: oldest ? `самая старая открыта ${formatRelative(oldest.openedAt)}` : 'очередь пуста',
      action: { label: 'В очередь', href: '/admin/moderation' },
    },
  ];
}

function resolvedTiles(page: CasesPage): TileView[] {
  const times = decisionTimes(page.items);
  const middle = median(times);
  return [
    {
      label: 'Решено заявок',
      hint: 'Заявки, по которым модератор или правило вынесли решение, за всё время',
      value: formatInt(page.total),
    },
    {
      label: 'Время до решения',
      hint: 'Медиана времени от открытия заявки до решения',
      value: middle === null ? '—' : formatSpan(middle),
      note: times.length
        ? `по ${formatInt(times.length)} последним решённым`
        : 'решённых заявок нет',
    },
  ];
}

function restrictionTiles(page: RestrictionsPage): TileView[] {
  return [
    {
      label: 'Действующие ограничения',
      hint: 'Пользователи, которым сейчас запрещено публиковать, голосовать или жаловаться',
      value: formatInt(page.total),
      action: { label: 'К списку', href: '/admin/restrictions' },
    },
  ];
}

export function ReviewsTab() {
  const [period] = usePeriod();
  const step = stepOf(period.days);
  const by = step === 'day' ? 'по дням' : 'по месяцам';
  const stats = useModerationStats(period.days);
  const open = useOpenCases();
  const resolved = useResolvedCases();
  const restrictions = useActiveRestrictions();
  const verification = useVerification();
  const sync = useReviewsSync();
  const summaries = useSummaries();

  return (
    <TabFrame tab="reviews">
      <TileGrid count={4}>
        <Tiles resource={open} name="очередь модерации">
          {openTiles}
        </Tiles>
        <Tiles resource={resolved} name="решённые заявки">
          {resolvedTiles}
        </Tiles>
        <Tiles resource={restrictions} name="ограничения">
          {restrictionTiles}
        </Tiles>
      </TileGrid>
      <div className="st-cols st-stretch" data-cols="3">
        <SourcePanel
          title="Очередь на проверке"
          hint="Открытые заявки: почему они попали к модератору и о чём они"
          resource={open}
        >
          {(page) => {
            if (!page.items.length) return <Nothing title="Очередь пуста" />;
            const note = sampleNote(page.items.length, page.total, 'самым старым заявкам');
            return (
              <VStack gap={4}>
                <SegmentBar
                  segments={reasonSegments(page.items)}
                  label="Открытые заявки по причинам"
                />
                <VStack gap={2}>
                  <SubHeading>Что проверяют</SubHeading>
                  <SegmentBar
                    segments={targetSegments(page.items)}
                    label="Открытые заявки по типу"
                  />
                </VStack>
                {note ? (
                  <Text type="supporting" color="secondary">
                    {note}
                  </Text>
                ) : null}
              </VStack>
            );
          }}
        </SourcePanel>
        <SourcePanel
          title="Последние решённые заявки"
          hint={`Не больше ${SAMPLE_SIZE} последних решений: с чего начинались заявки и сколько ждали`}
          resource={resolved}
        >
          {(page) => {
            const times = decisionTimes(page.items);
            const middle = median(times);
            const longest = times.at(-1);
            if (!page.items.length) return <Nothing title="Решённых заявок пока нет" />;
            return (
              <VStack gap={4}>
                <Facts
                  rows={[
                    ['Заявок в выборке', formatInt(page.items.length)],
                    ['Медиана до решения', middle === null ? '—' : formatSpan(middle)],
                    ['Самое долгое решение', longest === undefined ? '—' : formatSpan(longest)],
                  ]}
                />
                <SegmentBar
                  segments={reasonSegments(page.items)}
                  label="Последние решённые заявки по причинам"
                />
              </VStack>
            );
          }}
        </SourcePanel>
        <SourcePanel
          title="Ограничения"
          hint="Что запрещено пользователям с действующим ограничением"
          resource={restrictions}
        >
          {(page) => {
            if (!page.items.length) return <Nothing title="Действующих ограничений нет" />;
            const note = sampleNote(page.items.length, page.total, 'последним ограничениям');
            return (
              <VStack gap={4}>
                <SegmentBar
                  segments={capabilitySegments(page.items)}
                  label="Действующие ограничения по действию"
                />
                {note ? (
                  <Text type="supporting" color="secondary">
                    {note}
                  </Text>
                ) : null}
              </VStack>
            );
          }}
        </SourcePanel>
      </div>
      <div className="st-cols st-stretch" data-cols="3">
        <SourcePanel
          title={REVIEW_CHECK_NAME}
          hint="Свои отзывы по тому, подтвердила ли ИСУ, что преподаватель вёл у автора"
          resource={verification}
        >
          {(data) => (
            <SegmentBar
              segments={verificationSegments(data)}
              label="Свои отзывы по проверке автора"
            />
          )}
        </SourcePanel>
        <SourcePanel
          title="Внешние отзывы"
          hint="Копия базы проекта Reviews, которую Бэкенд сверяет с источником"
          resource={sync}
        >
          {(data) => (
            <Facts
              rows={[
                ['Отзывов в базе', formatInt(data.reviewsActive)],
                ['Преподавателей с отзывами', formatInt(data.teachersActive)],
                ['Удалено в источнике', formatInt(data.reviewsRemoved)],
                ['Отзывов в источнике', formatInt(data.upstreamReviews)],
                [
                  `Последняя ${SYNC_NAME.toLowerCase()}`,
                  data.lastOutcome ? (
                    <StatusLine health={SYNC_OUTCOMES[data.lastOutcome]} />
                  ) : (
                    'не было'
                  ),
                ],
              ]}
            />
          )}
        </SourcePanel>
        <SourcePanel
          title="ИИ-сводки"
          hint="Преподаватели с тремя и более отзывами, по состоянию сводки"
          resource={summaries}
        >
          {(data) => (
            <VStack gap={4}>
              <SegmentBar segments={summarySegments(data)} label="ИИ-сводки по состоянию" />
              <VStack gap={2}>
                <span className="st-kv">
                  <Text type="body">Запросов к модели сегодня</Text>
                  <Text type="body" weight="semibold" hasTabularNumbers>
                    {formatInt(data.budgetUsed)} из {formatInt(data.dailyBudget)}
                  </Text>
                </span>
                <Meter value={data.budgetUsed} max={data.dailyBudget} color="purple" />
              </VStack>
            </VStack>
          )}
        </SourcePanel>
      </div>
      {/* What is above is the queue and the bases as they are now; the period starts here. */}
      <PeriodControl />
      <div className="st-cols st-stretch" data-cols="2">
        <SourcePanel
          title={METRICS.reviews_created.name}
          hint={`Отзывы пользователей приложения о преподавателях; ${by}, ${period.span}`}
          resource={stats}
        >
          {(data) => (
            <>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                Своих отзывов сейчас: {formatInt(data.ownReviews)}
              </Text>
              <TimeChart chart={reviewsChart(data, step)} />
            </>
          )}
        </SourcePanel>
        <SourcePanel
          title={METRICS.cases_flow.name}
          hint={`Успевает ли модерация: открытые и решённые заявки ${by}, ${period.span}`}
          resource={stats}
        >
          {(data) => {
            const backlog = backlogOf(data);
            return (
              <>
                {backlog ? (
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    В очереди на конец первого дня: {formatInt(backlog.start)}, последнего:{' '}
                    {formatInt(backlog.end)}
                  </Text>
                ) : null}
                <TimeChart chart={casesFlowChart(data, step)} />
              </>
            );
          }}
        </SourcePanel>
      </div>
      <div className="st-cols st-stretch" data-cols="3">
        <SourcePanel
          title={METRICS.review_votes.name}
          hint={`Голоса, которые ещё стоят, по дню, когда их отдали; ${by}, ${period.span}`}
          resource={stats}
        >
          {(data) => <TimeChart chart={votesChart(data, step)} height={200} />}
        </SourcePanel>
        <SourcePanel
          title={METRICS.decisions.name}
          hint={`Решения по заявкам ${period.span}, кроме отменённых`}
          resource={stats}
        >
          {(data) => {
            const decisions = decisionSegments(data);
            if (!decisions.length) return <Nothing title={`Решений ${period.span} не было`} />;
            return (
              <>
                <SegmentBar segments={decisions} label="Решения по заявкам по действию" />
                <VStack gap={2}>
                  <SubHeading>Кто решал</SubHeading>
                  <SegmentBar segments={actorSegments(data)} label="Кто принимал решения" />
                </VStack>
              </>
            );
          }}
        </SourcePanel>
        <SourcePanel
          title={METRICS.reports.name}
          hint={`На ссылки и отзывы, ${period.span}, по причине`}
          resource={stats}
        >
          {(data) => {
            const reasons = reportSegments(data);
            if (!reasons.length) return <Nothing title={`Жалоб ${period.span} не было`} />;
            const totals = reportTotals(data);
            return (
              <>
                <SegmentBar segments={reasons} label="Жалобы по причинам" />
                <Facts
                  rows={[
                    ['Всего жалоб', formatInt(totals.total)],
                    ['Отклонено модератором', formatPct(totals.dismissed, 0)],
                  ]}
                />
              </>
            );
          }}
        </SourcePanel>
      </div>
    </TabFrame>
  );
}
