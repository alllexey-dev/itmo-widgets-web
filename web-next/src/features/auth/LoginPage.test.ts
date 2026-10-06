import { screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import {
  challengeOf,
  fail,
  mockChallenges,
  mockPoll,
  mockSession,
  mockSignedOut,
  ok,
  server,
  userOf,
} from '../../test/server';

function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  Reflect.deleteProperty(document, 'visibilityState');
  vi.useRealTimers();
});

describe('LoginPage', () => {
  it('shows the QR, the code in groups of four and the time left', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    mockPoll();

    renderApp('/login');

    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Вход на сайт' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Скачать' })).toHaveAttribute('href', '/#download');
  });

  it('waits for the app and goes home once the sign-in is approved', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let signedIn = false;
    let polls = 0;
    server.use(
      http.get('*/api/web/auth/me', () => (signedIn ? ok(userOf([])) : fail(401, 'unauthorized'))),
    );
    mockChallenges('ABCDEFGH');
    mockPoll(() => {
      polls += 1;
      if (polls < 2) return 'PENDING';
      signedIn = true;
      return 'APPROVED';
    });
    renderApp('/login');
    expect(await screen.findByText('Ждём подтверждения в приложении')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/');
  });

  it('shows a new code when the backend reports the old one expired', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH', 'KMNPQRST');
    mockPoll((code) => (code === 'ABCDEFGH' ? 'EXPIRED' : 'PENDING'));

    renderApp('/login');

    expect(await screen.findByText('KMNP QRST')).toBeInTheDocument();
    expect(screen.queryByText('ABCD EFGH')).not.toBeInTheDocument();
  });

  it('shows a new code when the countdown ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSignedOut();
    mockChallenges('ABCDEFGH', 'KMNPQRST');
    mockPoll();
    renderApp('/login');
    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(120_000);

    expect(await screen.findByText('KMNP QRST')).toBeInTheDocument();
  });

  it('stops after five renewals in a row and waits for the user', async () => {
    mockSignedOut();
    const challenges = mockChallenges('ABCDEFGH');
    mockPoll(() => 'EXPIRED');
    renderApp('/login');

    const renew = await screen.findByRole('button', { name: 'Показать новый код' });
    expect(screen.getByText('Код устарел')).toBeInTheDocument();
    expect(challenges.created()).toBe(6);

    mockPoll();
    await userEvent.click(renew);

    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    expect(challenges.created()).toBe(7);
  });

  it('asks to wait when too many codes were requested and retries on demand', async () => {
    mockSignedOut();
    let attempts = 0;
    server.use(
      http.post('*/api/web/auth/challenges', () => {
        attempts += 1;
        return attempts === 1
          ? fail(429, 'rate_limited', 'Too many login codes, try again later')
          : ok(challengeOf('ABCDEFGH'));
      }),
    );
    mockPoll();
    renderApp('/login');

    expect(
      await screen.findByText('Слишком много попыток, подождите пару минут'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByText('ABCD EFGH')).toBeInTheDocument();
    expect(
      screen.queryByText('Слишком много попыток, подождите пару минут'),
    ).not.toBeInTheDocument();
  });

  it('explains other failures without the backend message', async () => {
    mockSignedOut();
    server.use(
      http.post('*/api/web/auth/challenges', () => fail(500, 'internal_server_error', 'boom')),
    );

    renderApp('/login');

    expect(await screen.findByText('Не удалось получить код')).toBeInTheDocument();
    expect(screen.getByText('Попробуйте ещё раз')).toBeInTheDocument();
  });

  it('tells the user when the server cannot be reached and keeps polling', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    let polls = 0;
    server.use(
      http.get('*/api/web/auth/challenges/:id', () => {
        polls += 1;
        return polls === 1 ? Response.error() : ok({ status: 'PENDING' as const });
      }),
    );

    renderApp('/login');

    expect(await screen.findByText('Нет связи с сервером, пробуем снова')).toBeInTheDocument();
    expect(await screen.findByText('Ждём подтверждения в приложении')).toBeInTheDocument();
  });

  it('pauses polling while the tab is hidden and polls again on return', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    let polls = 0;
    mockPoll(() => {
      polls += 1;
      return 'PENDING';
    });
    renderApp('/login');
    await waitFor(() => expect(polls).toBe(1));

    setTabHidden(true);
    await vi.advanceTimersByTimeAsync(10_000);
    const pollsWhileHidden = polls;
    setTabHidden(false);

    expect(pollsWhileHidden).toBe(1);
    await waitFor(() => expect(polls).toBe(2));
  });

  it('sends a signed-in user home', async () => {
    mockSession(userOf([]));

    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Анна Смирнова' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/');
  });

  it('asks to open a code scanned by a phone camera in the app', async () => {
    mockSignedOut();
    const challenges = mockChallenges('KMNPQRST');
    mockPoll();
    renderApp('/login?code=abcdefgh');

    expect(
      await screen.findByRole('heading', { name: 'Откройте этот код в приложении ITMO.Widgets' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ABCD EFGH')).toBeInTheDocument();
    expect(challenges.created()).toBe(0);

    await userEvent.click(
      screen.getByRole('button', { name: 'Войти в браузере на этом устройстве' }),
    );

    expect(await screen.findByText('KMNP QRST')).toBeInTheDocument();
    expect(location.search).toBe('');
  });

  it('ignores a scanned value that is not a sign-in code', async () => {
    mockSignedOut();
    mockChallenges('KMNPQRST');
    mockPoll();

    renderApp('/login?code=not-a-code');

    expect(await screen.findByText('KMNP QRST')).toBeInTheDocument();
  });
});
