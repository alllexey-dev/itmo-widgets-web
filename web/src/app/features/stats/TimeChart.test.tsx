import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderInApp } from '../../test/render';
import type { Chart } from './model';
import { TimeChart } from './TimeChart';

const days = ['1 сент.', '2 сент.', '3 сент.'];

/** Three days of three rolling windows, or of three stacked client kinds. */
function chartOf(kind: Chart['kind']): Chart {
  return {
    kind,
    unit: 'count',
    series: [
      { key: 'a', label: 'За день', color: 'blue' },
      { key: 'b', label: 'За 7 дней', color: 'orange' },
      { key: 'c', label: 'За 30 дней', color: 'green' },
    ],
    points: days.map((label, index) => ({
      label,
      full: label,
      values: { a: 10 + index, b: 20 + index, c: 30 + index },
    })),
    label: 'Активные клиенты по дням',
    per: 'day',
  };
}

function show(kind: Chart['kind'] = 'line') {
  renderInApp(<TimeChart chart={chartOf(kind)} />);
  const chart = screen.getByRole('figure', { name: 'Активные клиенты по дням' });
  return { chart, readout: within(chart).getByRole('status') };
}

describe('TimeChart', () => {
  it('describes itself in one sentence for a screen reader', () => {
    const { chart } = show();

    expect(chart).toHaveAccessibleDescription(
      /^С 1 сент\. по 3 сент\.; За день: последнее значение 12, от 10 до 12; .*За 30 дней: последнее значение 32, от 30 до 32\. Стрелки/,
    );
  });

  it('steps through the points with the arrow keys, starting from the latest', async () => {
    const { chart, readout } = show();
    expect(readout).toBeEmptyDOMElement();

    chart.focus();
    await userEvent.keyboard('{ArrowLeft}');

    expect(readout).toHaveTextContent(/^3 сент\.За день12За 7 дней22За 30 дней32$/);

    await userEvent.keyboard('{ArrowLeft}');
    expect(readout).toHaveTextContent(/^2 сент\./);

    await userEvent.keyboard('{Home}{ArrowLeft}');
    expect(readout).toHaveTextContent(/^1 сент\.За день10/);

    await userEvent.keyboard('{End}{ArrowRight}');
    expect(readout).toHaveTextContent(/^3 сент\./);
  });

  it('puts the readout away on Escape and when the chart loses focus', async () => {
    const { chart, readout } = show();
    chart.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(readout).toHaveAttribute('data-on', 'true');

    await userEvent.keyboard('{Escape}');
    expect(readout).toHaveAttribute('data-on', 'false');

    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.tab();
    expect(readout).toHaveAttribute('data-on', 'false');
  });

  it('hides and shows a series from its legend entry', async () => {
    const { chart, readout } = show();
    const week = within(chart).getByRole('button', { name: 'За 7 дней' });
    expect(week).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(week);

    expect(week).toHaveAttribute('aria-pressed', 'false');
    chart.focus();
    await userEvent.keyboard('{End}');
    expect(readout).toHaveTextContent(/^3 сент\.За день12За 30 дней32$/);

    await userEvent.click(week);

    expect(week).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the last series on the chart', async () => {
    const { chart } = show();
    const [day, week, month] = within(chart).getAllByRole('button');
    if (!day || !week || !month) throw new Error('The chart has three series');

    await userEvent.click(day);
    await userEvent.click(week);
    await userEvent.click(month);

    expect(day).toHaveAttribute('aria-pressed', 'false');
    expect(week).toHaveAttribute('aria-pressed', 'false');
    expect(month).toHaveAttribute('aria-pressed', 'true');
  });

  it('reads a stacked column top to bottom with its total', async () => {
    const { chart, readout } = show('stacked');

    chart.focus();
    await userEvent.keyboard('{End}');

    expect(readout).toHaveTextContent(/^3 сент\.За 30 дней32За 7 дней22За день12Всего66$/);
  });

  it('has no legend for a single series', () => {
    const single = chartOf('bars');
    renderInApp(<TimeChart chart={{ ...single, series: single.series.slice(0, 1) }} />);

    const chart = screen.getByRole('figure', { name: 'Активные клиенты по дням' });
    expect(within(chart).queryByRole('button')).not.toBeInTheDocument();
  });
});
