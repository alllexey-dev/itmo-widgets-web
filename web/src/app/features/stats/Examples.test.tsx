import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { EXAMPLE_SERVER_ERRORS } from '../../lib/exampleValues';
import { mockStats } from '../../test/stats';
import { autoSignOutcomes, autoSignSuccess, pairingFunnel } from './examples';
import { formatPct, formatValue } from './format';
import { waitingOn, type MetricId } from './metrics';
import type { TabId } from './types';
import type * as Metrics from './metrics';

// The switch and the registry as the page sees them: a test can turn the examples off, or give a
// metric a real source, the way an edit of metrics.ts would.
const registry = vi.hoisted(() => ({ examples: true, answered: [] as string[] }));

vi.mock('./metrics', async (original) => {
  const real = await original<typeof Metrics>();
  return {
    ...real,
    get SHOW_EXAMPLES() {
      return registry.examples;
    },
    get METRICS() {
      return Object.fromEntries(
        Object.entries(real.METRICS).map(([id, metric]) => [
          id,
          registry.answered.includes(id) ? { ...metric, source: 'api' } : metric,
        ]),
      );
    },
  };
});

beforeEach(() => {
  registry.examples = true;
  registry.answered = [];
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

function exampleBlocks(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[data-example]')];
}

/** The text of every tile, panel and card of the tab that is not an example, in page order. */
function realBlocks(): (string | null)[] {
  return [...document.querySelectorAll('.st-tab-body [role="group"], .st-tab-body [role="region"]')]
    .filter((block) => !block.closest('[data-example]'))
    .map((block) => block.textContent);
}

/** A formatted value as an element's text content has it: every space is a plain one. */
const plain = (text: string) => text.replace(/\s/g, ' ');

function exampleOf(metric: MetricId): HTMLElement {
  const block = exampleBlocks().find((item) => item.dataset.example === metric);
  if (!block) throw new Error(`No example block of ${metric}`);
  return block;
}

describe('Statistics examples', () => {
  it.each(TABS)(
    'draws on the %s tab every metric that waits for Backend, each block marked once',
    async (tab, group) => {
      mockSession(userOf(['ADMIN']));
      mockStats();

      await openTab(tab, group);

      const blocks = exampleBlocks();
      const drawn = new Set(blocks.map((block) => block.dataset.example));
      expect([...drawn].sort()).toEqual(
        waitingOn(tab)
          .map((metric) => metric.id)
          .sort(),
      );
      for (const block of blocks) {
        expect(within(block).getAllByText('пример')).toHaveLength(1);
      }
      // The mark appears nowhere else: not in a real block, not loose on the page.
      expect(screen.getAllByText('пример')).toHaveLength(blocks.length);
      expect(screen.getByText(NOTE)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Появится позже/ })).not.toBeInTheDocument();
    },
  );

  it.each(TABS)(
    'leaves the real blocks of the %s tab as they are without examples, and asks nothing more',
    async (tab, group) => {
      mockSession(userOf(['ADMIN']));
      const requested = mockStats();
      await openTab(tab, group);
      const withExamples = realBlocks();
      const askedWithExamples = [...new Set(requested)].sort();
      expect(withExamples.length).toBeGreaterThan(0);
      for (const text of withExamples) expect(text).not.toContain('пример');

      cleanup();
      requested.length = 0;
      registry.examples = false;
      await openTab(tab, group);

      expect(exampleBlocks()).toHaveLength(0);
      expect(screen.queryByText('пример')).not.toBeInTheDocument();
      expect(screen.queryByText(NOTE)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Появится позже/ })).toBeInTheDocument();
      expect(realBlocks()).toEqual(withExamples);
      expect([...new Set(requested)].sort()).toEqual(askedWithExamples);
    },
  );

  it('draws an example in the form of its metric: a tile, a chart, a table, a breakdown', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    await openTab('sport', 'Автозапись');

    const speed = screen.getByRole('group', { name: 'Скорость автозаписи' });
    expect(speed).toHaveAttribute('data-example', 'auto_sign_latency');
    expect(speed).toHaveTextContent('6 с');
    const created = screen.getByRole('region', { name: 'Новые заявки на автозапись' });
    expect(
      within(created).getByRole('figure', { name: 'Новые заявки на автозапись: пример, 30 дней' }),
    ).toBeInTheDocument();
    const sections = screen.getByRole('region', { name: 'Популярные секции' });
    expect(within(sections).getAllByRole('row', { name: /Плавание|Волейбол|Йога/ })).toHaveLength(
      3,
    );
    const outcomes = screen.getByRole('region', { name: 'Чем заканчивается автозапись' });
    expect(within(outcomes).getByText('Записаны').closest('li')).toHaveTextContent(
      String(autoSignOutcomes()[0]?.value),
    );
  });

  it('shows the same invented value wherever a metric appears', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    await openTab('overview', 'Пользователи');

    expect(exampleOf('auto_sign_outcomes')).toHaveTextContent(plain(formatPct(autoSignSuccess())));
    expect(exampleOf('error_rate')).toHaveTextContent(
      plain(formatValue(EXAMPLE_SERVER_ERRORS.share, 'rate')),
    );
    expect(
      within(exampleOf('feature_usage')).getByRole('row', { name: /Расписание друзей/ }),
    ).toHaveTextContent(/486.*52,9/);
  });

  it('keeps the examples about people out of the section about clients', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    await openTab('audience', 'Активны за сутки');

    const people = screen.getByRole('region', { name: 'Люди и удержание' });
    expect(people).toContainElement(exampleOf('active_people'));
    expect(people).toContainElement(exampleOf('retention'));
    expect(people).toContainElement(exampleOf('retention_classic'));
    // The clients section, with its filters and its "это не люди", holds no example at all.
    const clients = screen.getByRole('region', { name: 'Клиенты' });
    expect(within(clients).queryByText('пример')).not.toBeInTheDocument();
  });

  it('counts the same thing the same in two examples of one tab', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    await openTab('features', 'Дружбы');

    // The feature row and the last step of the funnel are the connections of the same 30 days.
    const connected = pairingFunnel().at(-1)?.value ?? 0;
    expect(
      within(exampleOf('feature_usage')).getByRole('row', { name: /Подключённые клиенты/ }),
    ).toHaveTextContent(new RegExp(`${connected} подключен`));
    expect(
      within(exampleOf('pairing')).getByText('Клиент подключён').closest('li'),
    ).toHaveTextContent(String(connected));
  });

  it('drops the example of a metric once the registry gives it a real source', async () => {
    registry.answered = ['sport_slots', 'queue_wait'];
    mockSession(userOf(['ADMIN']));
    mockStats();

    await openTab('sport', 'Автозапись');

    expect(
      screen.queryByRole('region', { name: 'Когда хотят заниматься' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Ожидание в очереди' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Популярные секции' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Скорость автозаписи' })).toBeInTheDocument();
  });
});
