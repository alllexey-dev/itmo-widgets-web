import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp, renderInApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { mockStats } from '../../test/stats';
import type * as Metrics from './metrics';
import { ExamplePanel, ExampleTiles, TabFrame } from './parts';
import type { TabId } from './types';

// The switch and the registry as the page sees them: a test can turn the examples off, or take
// the data of a metric away, the way an edit of metrics.ts would.
const registry = vi.hoisted(() => ({ examples: true, waiting: [] as string[] }));

vi.mock('./metrics', async (original) => {
  const real = await original<typeof Metrics>();
  const metrics = () =>
    Object.fromEntries(
      Object.entries(real.METRICS).map(([id, metric]) => [
        id,
        registry.waiting.includes(id) ? { ...metric, source: 'endpoint' } : metric,
      ]),
    ) as typeof real.METRICS;
  const all = () =>
    Object.entries(metrics()).map(([id, metric]) => ({ id, ...metric }) as Metrics.Metric);
  const shownOn = (tab: TabId, metric: Metrics.MetricDef) =>
    tab === 'overview' ? metric.overview === true : metric.tab === tab;
  return {
    ...real,
    get SHOW_EXAMPLES() {
      return registry.examples;
    },
    get METRICS() {
      return metrics();
    },
    drawnOn: (tab: TabId) =>
      all().filter((metric) => metric.source === 'api' && shownOn(tab, metric)),
    waitingOn: (tab: TabId) =>
      all().filter((metric) => metric.source !== 'api' && shownOn(tab, metric)),
  };
});

beforeEach(() => {
  registry.examples = true;
  registry.waiting = [];
});

const TABS: [TabId, string][] = [
  ['overview', 'Пользователи'],
  ['audience', 'Активны за сутки'],
  ['features', 'Дружбы'],
  ['sport', 'Автозапись'],
  ['reviews', 'Действующие ограничения'],
  ['system', 'Каталог спорта'],
];

const NOTE =
  'Часть этой вкладки — примеры с пометкой «пример»: Бэкенд пока не отдаёт для них данные.';

/** Opens a tab and waits until every source of it has answered. */
async function openTab(tab: TabId, group: string) {
  renderApp(`/admin/dashboard?tab=${tab}`);
  await screen.findByRole('group', { name: group });
  await waitFor(() => expect(screen.queryAllByRole('progressbar')).toHaveLength(0));
}

/** The text of every tile, panel and card of the tab, in page order. */
function blocks(): (string | null)[] {
  return [
    ...document.querySelectorAll('.st-tab-body [role="group"], .st-tab-body [role="region"]'),
  ].map((block) => block.textContent);
}

describe('Statistics examples', () => {
  it.each(TABS)(
    'draws no example on the %s tab: Backend answers every metric of it',
    async (tab, group) => {
      mockSession(userOf(['ADMIN']));
      mockStats();

      await openTab(tab, group);

      expect(document.querySelector('[data-example]')).toBeNull();
      expect(screen.queryByText('пример')).not.toBeInTheDocument();
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Появится позже/ })).not.toBeInTheDocument();
    },
  );

  it.each(TABS)(
    'leaves the %s tab the same with the examples switched off, and asks the same',
    async (tab, group) => {
      mockSession(userOf(['ADMIN']));
      const requested = mockStats();
      await openTab(tab, group);
      const withExamples = blocks();
      const askedWithExamples = [...new Set(requested)].sort();
      expect(withExamples.length).toBeGreaterThan(0);

      cleanup();
      requested.length = 0;
      registry.examples = false;
      await openTab(tab, group);

      expect(blocks()).toEqual(withExamples);
      expect([...new Set(requested)].sort()).toEqual(askedWithExamples);
    },
  );

  it('draws an example only while its metric waits for Backend, marked once', () => {
    const examples = (
      <>
        <ExamplePanel metric="sport_slots">
          <p>Слоты занятий</p>
        </ExamplePanel>
        <ExampleTiles count={2} tiles={[['queue_wait', { label: 'Ожидание', value: '1 ч' }]]} />
      </>
    );
    renderInApp(examples);
    expect(screen.queryByText('Слоты занятий')).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ожидание' })).not.toBeInTheDocument();
    cleanup();

    registry.waiting = ['sport_slots', 'queue_wait'];
    renderInApp(examples);

    const panel = screen.getByRole('region', { name: 'Когда хотят заниматься' });
    expect(panel).toHaveAttribute('data-example', 'sport_slots');
    expect(within(panel).getAllByText('пример')).toHaveLength(1);
    const tile = screen.getByRole('group', { name: 'Ожидание' });
    expect(tile).toHaveAttribute('data-example', 'queue_wait');
    expect(within(tile).getAllByText('пример')).toHaveLength(1);
  });

  it('says that a part of a tab is examples while a metric of it waits', () => {
    registry.waiting = ['sport_slots'];

    renderInApp(
      <TabFrame tab="sport">
        <p>Заявки на спорт</p>
      </TabFrame>,
    );

    expect(screen.getByText(NOTE)).toBeInTheDocument();
    expect(screen.getByText('Заявки на спорт')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Появится позже/ })).not.toBeInTheDocument();
  });

  it('lists a waiting metric by name instead when the examples are off', () => {
    registry.waiting = ['sport_slots'];
    registry.examples = false;

    renderInApp(
      <TabFrame tab="sport">
        <ExamplePanel metric="sport_slots">
          <p>Слоты занятий</p>
        </ExamplePanel>
      </TabFrame>,
    );

    expect(screen.getByRole('button', { name: 'Появится позже · 1' })).toBeInTheDocument();
    expect(screen.queryByText('Слоты занятий')).not.toBeInTheDocument();
    expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
  });
});
