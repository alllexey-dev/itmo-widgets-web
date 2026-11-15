import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { aiSummariesOf, reviewsSyncOf } from '../../test/admin';
import { renderApp } from '../../test/render';
import { mockSession, userOf } from '../../test/server';
import { caseItemOf, mockStats, restrictionOf, verificationOf } from '../../test/stats';
import type * as Metrics from './metrics';

// The examples of metrics without data are off here: these tests are about the real blocks, which
// are the same with examples on (Examples.test.tsx).
vi.mock('./metrics', async (original) => ({
  ...(await original<typeof Metrics>()),
  SHOW_EXAMPLES: false,
}));

function group(name: string) {
  return screen.findByRole('group', { name });
}

function region(name: string) {
  return screen.findByRole('region', { name });
}

const rowOf = (container: HTMLElement, name: string) =>
  within(container).getByText(name).closest('li, div');

const OPEN = [
  caseItemOf({ reason: 'SUBMISSION', targetType: 'TEACHER_REVIEW' }),
  caseItemOf({ reason: 'SUBMISSION' }),
  caseItemOf({ reason: 'REPORTS' }),
];

describe('Statistics reviews and moderation', () => {
  it('counts the open cases with a way to the queue', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ openCases: OPEN });

    renderApp('/admin/dashboard?tab=reviews');

    const open = await group('Открытые заявки');
    expect(open).toHaveTextContent('3');
    expect(open).toHaveTextContent('самая старая открыта 2 ч назад');
    expect(within(open).getByRole('link', { name: 'В очередь' })).toHaveAttribute(
      'href',
      '/app/admin/moderation',
    );
  });

  it('splits the queue by reason and by what is checked', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ openCases: OPEN });

    renderApp('/admin/dashboard?tab=reviews');

    const queue = await region('Очередь на проверке');
    expect(await within(queue).findByText('Что проверяют')).toBeInTheDocument();
    expect(rowOf(queue, 'Проверка перед публикацией')).toHaveTextContent(/2.*66,7/);
    expect(rowOf(queue, 'Жалобы')).toHaveTextContent(/1.*33,3/);
    expect(rowOf(queue, 'Голоса против')).toHaveTextContent('0');
    expect(rowOf(queue, 'Ссылки по предметам')).toHaveTextContent('2');
    expect(rowOf(queue, 'Отзывы о преподавателях')).toHaveTextContent('1');
    expect(queue).not.toHaveTextContent('Разбивка по');
  });

  it('says that a breakdown covers a part of a long queue', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ openCases: Array.from({ length: 120 }, () => caseItemOf()) });

    renderApp('/admin/dashboard?tab=reviews');

    expect(await group('Открытые заявки')).toHaveTextContent('120');
    const queue = await region('Очередь на проверке');
    expect(
      await within(queue).findByText('Разбивка по 100 самым старым заявкам из 120'),
    ).toBeInTheDocument();
    expect(rowOf(queue, 'Проверка перед публикацией')).toHaveTextContent('100');
  });

  it('says so when the queue is empty', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats();

    renderApp('/admin/dashboard?tab=reviews');

    const open = await group('Открытые заявки');
    expect(open).toHaveTextContent('0');
    expect(open).toHaveTextContent('очередь пуста');
    expect(await screen.findByRole('heading', { name: 'Очередь пуста' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Решённых заявок пока нет' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Действующих ограничений нет' }),
    ).toBeInTheDocument();
    expect(await group('Время до решения')).toHaveTextContent('решённых заявок нет');
  });

  it('measures the time to a decision over the latest resolved cases', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      resolvedCases: [
        caseItemOf({ reason: 'REPORTS' }, 10),
        caseItemOf({}, 30),
        caseItemOf({}, 600),
      ],
    });

    renderApp('/admin/dashboard?tab=reviews');

    expect(await group('Решено заявок')).toHaveTextContent('3');
    const time = await group('Время до решения');
    expect(time).toHaveTextContent('30 мин');
    expect(time).toHaveTextContent('по 3 последним решённым');
    const resolved = await region('Последние решённые заявки');
    expect(rowOf(resolved, 'Медиана до решения')).toHaveTextContent('30 мин');
    expect(rowOf(resolved, 'Самое долгое решение')).toHaveTextContent('10 ч');
    expect(rowOf(resolved, 'Жалобы')).toHaveTextContent(/1.*33,3/);
  });

  it('counts the active restrictions by what they forbid', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({
      restrictions: [
        restrictionOf({ capability: 'SUBMIT_RESOURCES' }),
        restrictionOf({ capability: 'ALL' }),
      ],
    });

    renderApp('/admin/dashboard?tab=reviews');

    const tile = await group('Действующие ограничения');
    expect(tile).toHaveTextContent('2');
    expect(within(tile).getByRole('link', { name: 'К списку' })).toHaveAttribute(
      'href',
      '/app/admin/restrictions',
    );
    const restrictions = await region('Ограничения');
    expect(rowOf(restrictions, 'Публикация ссылок')).toHaveTextContent(/1.*50,0/);
    expect(rowOf(restrictions, 'Все действия')).toHaveTextContent('1');
    expect(within(restrictions).queryByText('Голосование')).not.toBeInTheDocument();
  });

  it('shows the author checks of own reviews', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ verification: verificationOf({ pending: 4, verified: 120, unverified: 16 }) });

    renderApp('/admin/dashboard?tab=reviews');

    const checks = await region('Проверка по ИСУ');
    expect(await within(checks).findByText('Подтверждено')).toBeInTheDocument();
    expect(rowOf(checks, 'Подтверждено')).toHaveTextContent(/120.*85,7/);
    expect(rowOf(checks, 'На проверке')).toHaveTextContent('4');
    expect(rowOf(checks, 'Не подтверждено')).toHaveTextContent('16');
  });

  it('shows the copy of the external reviews and its latest check', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ sync: reviewsSyncOf({ lastOutcome: 'FAILED' }) });

    renderApp('/admin/dashboard?tab=reviews');

    const external = await region('Внешние отзывы');
    expect(await within(external).findByText('Отзывов в базе')).toBeInTheDocument();
    expect(rowOf(external, 'Отзывов в базе')).toHaveTextContent('880');
    expect(rowOf(external, 'Преподавателей с отзывами')).toHaveTextContent('118');
    expect(rowOf(external, 'Удалено в источнике')).toHaveTextContent('20');
    expect(rowOf(external, 'Отзывов в источнике')).toHaveTextContent('900');
    expect(rowOf(external, 'Последняя синхронизация')).toHaveTextContent('Ошибка');
  });

  it('shows the AI summaries by state and the request budget of the day', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ summaries: aiSummariesOf({ failed: 3 }) });

    renderApp('/admin/dashboard?tab=reviews');

    const summaries = await region('ИИ-сводки');
    expect(await within(summaries).findByText('Готовы')).toBeInTheDocument();
    expect(rowOf(summaries, 'Готовы')).toHaveTextContent(/40.*87,0/);
    expect(rowOf(summaries, 'В очереди')).toHaveTextContent('2');
    expect(rowOf(summaries, 'С ошибкой')).toHaveTextContent('3');
    expect(rowOf(summaries, 'Скрыты')).toHaveTextContent('1');
    expect(summaries).toHaveTextContent('Запросов к модели сегодня12 из 400');
  });

  it('keeps the rest of the tab when the queue fails to load', async () => {
    mockSession(userOf(['ADMIN']));
    mockStats({ openCases: null, resolvedCases: [caseItemOf({}, 30)] });

    renderApp('/admin/dashboard?tab=reviews');

    expect(await screen.findByText('Не удалось загрузить очередь модерации')).toBeInTheDocument();
    expect(await group('Решено заявок')).toHaveTextContent('1');
    expect(await region('ИИ-сводки')).toHaveTextContent('Готовы');
    expect(screen.queryByRole('group', { name: 'Открытые заявки' })).not.toBeInTheDocument();
  });
});
