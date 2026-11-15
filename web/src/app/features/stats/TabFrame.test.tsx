import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderInApp } from '../../test/render';
import type { MetricDef } from './metrics';
import { TabFrame } from './parts';

const waiting = vi.hoisted(() => ({ drawn: 0 }));

vi.mock('./metrics', () => {
  const metric = (id: string, name: string): MetricDef & { id: string } => ({
    id,
    name,
    tab: 'sport',
    source: 'endpoint',
    needs: 'sport_auto_sign_entries',
  });
  return {
    SHOW_EXAMPLES: false,
    drawnOn: () =>
      Array.from({ length: waiting.drawn }, (_, index) => metric(`m${index}`, `Метрика ${index}`)),
    waitingOn: () => [
      metric('sport_sections', 'Популярные секции'),
      metric('sport_slots', 'Когда хотят заниматься'),
    ],
  };
});

describe('TabFrame', () => {
  it('shows an empty state for a tab whose every metric waits for Backend', () => {
    waiting.drawn = 0;

    renderInApp(
      <TabFrame tab="sport">
        <p>Заявки на спорт</p>
      </TabFrame>,
    );

    expect(screen.getByRole('heading', { name: 'Здесь пока нечего показать' })).toBeInTheDocument();
    expect(screen.queryByText('Заявки на спорт')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Появится позже · 2' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByText('Популярные секции')).toBeInTheDocument();
  });

  it('shows the content of a tab that has data for at least one metric', () => {
    waiting.drawn = 1;

    renderInApp(
      <TabFrame tab="sport">
        <p>Заявки на спорт</p>
      </TabFrame>,
    );

    expect(screen.getByText('Заявки на спорт')).toBeInTheDocument();
    expect(screen.queryByText('Здесь пока нечего показать')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Появится позже · 2' })).toBeInTheDocument();
  });
});
