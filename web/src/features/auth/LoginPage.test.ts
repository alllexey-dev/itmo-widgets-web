import { screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/render';
import {
  challengeOf,
  fail,
  mockChallenges,
  mockClaim,
  mockSession,
  mockSignedOut,
  ok,
  server,
  userOf,
} from '../../test/server';
import { mockStudentSources } from '../../test/student';
import { keyCommitment, verificationCode } from './pairing';

// A signed-in user lands on Главная, which loads the student cards.
beforeEach(() => void mockStudentSources());

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

const LINK = /^http:\/\/localhost(:\d+)?\/pair#v1\.([A-Z2-9]{8})\.([\w-]{43})\.([\w-]{22})$/;

function decode(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Copies the pairing link the QR encodes and splits it into its parts. */
async function copiedLink(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: 'Скопировать ссылку для приложения' }),
  );
  const link = await navigator.clipboard.readText();
  const [, , code = '', pk = '', s = ''] = LINK.exec(link) ?? [];
  return { link, code, publicKey: decode(pk), secret: decode(s) };
}

describe('LoginPage', () => {
  it('shows the QR, the code to compare and the time left', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    mockClaim();

    renderApp('/login');

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Вход на сайт' })).toBeInTheDocument();
    expect(screen.getByText(/^\d{3} \d{3}$/)).toBeInTheDocument();
    expect(screen.getByText('2:00')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Скачать' })).toHaveAttribute('href', '/#download');
  });

  it('creates a web connection whose commitment and code match the link', async () => {
    const user = userEvent.setup();
    mockSignedOut();
    const challenges = mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/login');

    const { link, code, publicKey, secret } = await copiedLink(user);

    expect(link).toMatch(LINK);
    expect(code).toBe('ABCDEFGH');
    expect(challenges.bodies).toEqual([
      {
        kind: 'CONNECT',
        client: 'web',
        keyCommitment: await keyCommitment(publicKey, secret),
        name: expect.any(String),
        version: 'local',
        scopes: ['user'],
      },
    ]);
    const [{ challengeId } = challengeOf('unused')] = challenges.issued;
    expect(
      screen.getByText(await verificationCode(challengeId, publicKey, secret)),
    ).toBeInTheDocument();
  });

  it('waits for the app and goes home once the claim succeeds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let signedIn = false;
    let claims = 0;
    mockSession(() => (signedIn ? userOf([]) : null));
    mockChallenges('ABCDEFGH');
    mockClaim(() => {
      claims += 1;
      if (claims < 2) return 'PENDING';
      signedIn = true;
      return 'CLAIMED';
    });
    renderApp('/login');
    expect(await screen.findByText('Ждём, когда приложение отсканирует QR')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2_000);

    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/');
  });

  it('asks to compare the code once the phone opened it and gives it ten minutes', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    mockClaim(() => 'OPENED');

    renderApp('/login');

    expect(await screen.findByText('Сверьте код и подтвердите в приложении')).toBeInTheDocument();
    expect(screen.getByText('10:00')).toBeInTheDocument();
  });

  it('shows a new code when the backend no longer knows the old one', async () => {
    mockSignedOut();
    const challenges = mockChallenges('ABCDEFGH', 'KMNPQRST');
    let claims = 0;
    server.use(
      http.post('*/api/pair/challenges/:id/claim', () => {
        claims += 1;
        return claims === 1 ? fail(404, 'not_found') : ok({ status: 'PENDING' });
      }),
    );

    renderApp('/login');

    await waitFor(() => expect(challenges.created()).toBe(2));
    expect(await screen.findByText('Ждём, когда приложение отсканирует QR')).toBeInTheDocument();
  });

  it('shows a new code when the countdown ends', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSignedOut();
    const challenges = mockChallenges('ABCDEFGH', 'KMNPQRST');
    mockClaim();
    renderApp('/login');
    expect(await screen.findByText('2:00')).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(120_000);

    await waitFor(() => expect(challenges.created()).toBe(2));
  });

  it('stops after five renewals in a row and waits for the user', async () => {
    mockSignedOut();
    const challenges = mockChallenges('ABCDEFGH');
    server.use(http.post('*/api/pair/challenges/:id/claim', () => fail(404, 'not_found')));
    renderApp('/login');

    const renew = await screen.findByRole('button', { name: 'Показать новый QR-код' });
    expect(screen.getByText('QR-код устарел')).toBeInTheDocument();
    expect(challenges.created()).toBe(6);

    mockClaim();
    await userEvent.click(renew);

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(challenges.created()).toBe(7);
  });

  it('asks to wait when too many codes were requested and retries on demand', async () => {
    mockSignedOut();
    let attempts = 0;
    server.use(
      http.post('*/api/pair/challenges', () => {
        attempts += 1;
        return attempts === 1
          ? fail(429, 'rate_limited', 'Too many challenges, try again later')
          : ok(challengeOf('ABCDEFGH'));
      }),
    );
    mockClaim();
    renderApp('/login');

    expect(
      await screen.findByText('Слишком много попыток, подождите пару минут'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(
      screen.queryByText('Слишком много попыток, подождите пару минут'),
    ).not.toBeInTheDocument();
  });

  it('explains other failures without the backend message', async () => {
    mockSignedOut();
    server.use(
      http.post('*/api/pair/challenges', () => fail(500, 'internal_server_error', 'boom')),
    );

    renderApp('/login');

    expect(await screen.findByText('Не удалось получить QR-код')).toBeInTheDocument();
    expect(screen.getByText('Попробуйте ещё раз')).toBeInTheDocument();
  });

  it('tells the user when the server cannot be reached and keeps claiming', async () => {
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    let claims = 0;
    server.use(
      http.post('*/api/pair/challenges/:id/claim', () => {
        claims += 1;
        return claims === 1 ? Response.error() : ok({ status: 'PENDING' });
      }),
    );

    renderApp('/login');

    expect(await screen.findByText('Нет связи с сервером, пробуем снова')).toBeInTheDocument();
    expect(await screen.findByText('Ждём, когда приложение отсканирует QR')).toBeInTheDocument();
  });

  it('pauses claiming while the tab is hidden and claims again on return', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSignedOut();
    mockChallenges('ABCDEFGH');
    let claims = 0;
    mockClaim(() => {
      claims += 1;
      return 'PENDING';
    });
    renderApp('/login');
    await waitFor(() => expect(claims).toBe(1));

    setTabHidden(true);
    await vi.advanceTimersByTimeAsync(10_000);
    const claimsWhileHidden = claims;
    setTabHidden(false);

    expect(claimsWhileHidden).toBe(1);
    await waitFor(() => expect(claims).toBe(2));
  });

  it('sends a signed-in user home', async () => {
    mockSession(userOf([]));

    renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Главная' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/');
  });

  it('ignores the code links of the removed sign-in', async () => {
    mockSignedOut();
    const challenges = mockChallenges('KMNPQRST');
    mockClaim();

    renderApp('/login?code=ABCDEFGH');

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(challenges.created()).toBe(1);
  });
});
