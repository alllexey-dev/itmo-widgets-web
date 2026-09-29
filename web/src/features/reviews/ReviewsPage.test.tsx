import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { minutesAgo } from '../../test/admin';
import { renderApp } from '../../test/render';
import { fail, mockSession, ok, server, sessionOf } from '../../test/server';
import type { ReviewsSyncStatus, ReviewVerification } from './types';

function statusOf(overrides: Partial<ReviewsSyncStatus> = {}): ReviewsSyncStatus {
  return {
    enabled: true,
    running: false,
    runningSince: null,
    lastCheckedAt: minutesAgo(60),
    lastChangedAt: minutesAgo(60 * 24),
    lastSuccessAt: minutesAgo(60),
    lastOutcome: 'UPDATED',
    lastError: null,
    lastAdded: 12,
    lastUpdated: 3,
    lastRemoved: 1,
    upstreamTeachers: 347,
    upstreamReviews: 1391,
    reviewsTotal: 1395,
    reviewsActive: 1391,
    reviewsRemoved: 4,
    teachersActive: 347,
    ...overrides,
  };
}

const verification: ReviewVerification = { pending: 4, verified: 1250, unverified: 37 };

/** Serves the sync state from memory; a start is refused like the backend does. */
function mockReviews(initial: ReviewsSyncStatus = statusOf()) {
  let current = initial;
  const starts: { csrf: string | null }[] = [];
  server.use(
    http.get('*/api/admin/reviews/verification', () => ok(verification)),
    http.get('*/api/admin/reviews/sync', () => ok(current)),
    http.post('*/api/admin/reviews/sync', ({ request }) => {
      starts.push({ csrf: request.headers.get('X-Web-Request') });
      if (!current.enabled || current.running) return fail(409, 'business_rule_violation');
      current = { ...current, running: true, runningSince: new Date().toISOString() };
      return ok(current);
    }),
  );
  return { starts };
}

function syncCard() {
  return screen.findByRole('region', { name: 'Синхронизация' });
}

function verificationCard() {
  return screen.findByRole('region', { name: 'Проверка по ИСУ' });
}

describe('ReviewsPage', () => {
  it('shows the last run and the review counters', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Обновлено')).toBeInTheDocument();
    expect(card).toHaveTextContent('Проверено');
    expect(card).toHaveTextContent('Последний запуск: +12, изменено 3, удалено 1');
    expect(within(card).getByRole('group', { name: 'Отзывов' })).toHaveTextContent(/1\s391/);
    expect(within(card).getByRole('group', { name: 'Удалено' })).toHaveTextContent('4');
    expect(within(card).getByRole('group', { name: 'Преподавателей' })).toHaveTextContent('347');
    expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeEnabled();
  });

  it('does not start a sync that is off on the server', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews(statusOf({ enabled: false, lastOutcome: null, lastCheckedAt: null }));

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Выключена на сервере')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeDisabled();
  });

  it('says when the sync has never run', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews(
      statusOf({
        lastOutcome: null,
        lastCheckedAt: null,
        lastChangedAt: null,
        lastSuccessAt: null,
        reviewsActive: 0,
        reviewsRemoved: 0,
        teachersActive: 0,
      }),
    );

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Ещё не запускалась')).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Последний запуск');
  });

  it('starts a sync and shows it running', async () => {
    mockSession(sessionOf(['ADMIN']));
    const { starts } = mockReviews();
    renderApp('/admin/reviews');
    const card = await syncCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Синхронизировать' }));

    expect(await within(card).findByText('Идёт синхронизация')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Синхронизировать' })).toBeDisabled();
    expect(starts).toEqual([{ csrf: '1' }]);
  });

  it('tells that a sync is already running when the start is refused', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    server.use(http.post('*/api/admin/reviews/sync', () => fail(409, 'business_rule_violation')));
    renderApp('/admin/reviews');
    const card = await syncCard();

    await userEvent.click(await within(card).findByRole('button', { name: 'Синхронизировать' }));

    expect(await screen.findByText('Синхронизация уже идёт')).toBeInTheDocument();
  });

  it('shows the error of a failed run', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews(statusOf({ lastOutcome: 'FAILED', lastError: 'HTTP 503 /teacher/100123' }));

    renderApp('/admin/reviews');

    const card = await syncCard();
    expect(await within(card).findByText('Ошибка')).toBeInTheDocument();
    expect(within(card).getByText('HTTP 503 /teacher/100123')).toBeInTheDocument();
  });

  it('retries a failed load', async () => {
    mockSession(sessionOf(['ADMIN']));
    let attempts = 0;
    server.use(
      http.get('*/api/admin/reviews/sync', () => {
        attempts += 1;
        return attempts === 1 ? fail(404, 'not_found') : ok(statusOf());
      }),
    );
    renderApp('/admin/reviews');
    const card = await syncCard();
    expect(await within(card).findByText('Не удалось загрузить синхронизацию')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

    expect(await within(card).findByText('Обновлено')).toBeInTheDocument();
  });

  it('counts own reviews by the ISU check', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();

    renderApp('/admin/reviews');

    const card = await verificationCard();
    expect(await within(card).findByRole('group', { name: 'На проверке' })).toHaveTextContent('4');
    expect(within(card).getByRole('group', { name: 'Подтверждено' })).toHaveTextContent(/1\s250/);
    expect(within(card).getByRole('group', { name: 'Не подтверждено' })).toHaveTextContent('37');
  });

  it('retries failed ISU check counters', async () => {
    mockSession(sessionOf(['ADMIN']));
    mockReviews();
    let attempts = 0;
    server.use(
      http.get('*/api/admin/reviews/verification', () => {
        attempts += 1;
        return attempts === 1 ? fail(404, 'not_found') : ok(verification);
      }),
    );
    renderApp('/admin/reviews');
    const card = await verificationCard();
    expect(await within(card).findByText('Не удалось загрузить проверку')).toBeInTheDocument();

    await userEvent.click(within(card).getByRole('button', { name: 'Повторить' }));

    expect(await within(card).findByRole('group', { name: 'Подтверждено' })).toBeInTheDocument();
  });
});
