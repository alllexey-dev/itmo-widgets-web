import { screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import fixture from '../../test/fixtures/user-devices.json';
import { renderApp } from '../../test/render';
import {
  fail,
  mockChallenges,
  mockClaim,
  mockSession,
  ok,
  server,
  userOf,
} from '../../test/server';
import { recorder } from '../../test/student';
import type { Connection, UserDevices } from './types';

// Backend's golden `userDevices.json`: an agent, this browser (…0603), a revoked MCP and two installs.
function devicesOf(): UserDevices {
  return structuredClone(fixture) as UserDevices;
}

/** The devices list and its changes, answered like Backend; returns the changing calls. */
function mockDevices(devices = devicesOf()) {
  const { calls, record } = recorder();
  server.use(
    http.get('*/api/users/me/devices', () => ok(devices)),
    http.put('*/api/users/me/connections/:id/scopes', async ({ request, params }) => {
      await record(request);
      const { scopes } = (await request.clone().json()) as { scopes: string[] };
      const connection = devices.connections.find((row) => row.id === params.id) as Connection;
      connection.scopes = connection.scopes.map((grant) => ({
        ...grant,
        granted: scopes.includes(grant.scope.id),
      }));
      return ok(connection);
    }),
    http.post('*/api/users/me/connections/:id/revoke', async ({ request, params }) => {
      await record(request);
      devices.connections = devices.connections.filter((row) => row.id !== params.id);
      return ok({});
    }),
    http.post('*/api/users/me/installs/:id/sign-out', async ({ request }) => {
      await record(request);
      return ok({});
    }),
  );
  return calls;
}

function connections() {
  return within(screen.getByRole('list', { name: 'Подключённые' }));
}

describe('DevicesPage', () => {
  it('lists live connections with this browser marked and the app installs', async () => {
    mockSession(userOf([]));
    mockDevices();

    renderApp('/me/devices');

    expect(await screen.findByRole('list', { name: 'Подключённые' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Устройства' })).toBeInTheDocument();
    expect(connections().getByText('nas')).toBeInTheDocument();
    expect(connections().getByText('Chrome, macOS')).toBeInTheDocument();
    expect(connections().getByText('Этот браузер')).toBeInTheDocument();
    // A revoked connection waits for the phone to end its ITMO session; it is not shown.
    expect(connections().queryByText('MacBook Air')).not.toBeInTheDocument();
    const installs = within(screen.getByRole('list', { name: 'Телефоны с приложением' }));
    expect(installs.getByText('Google Pixel 8')).toBeInTheDocument();
    expect(installs.getByText('ITMO.Widgets 2.4.0, Android API 36')).toBeInTheDocument();
    expect(installs.getByText('iOS')).toBeInTheDocument();
    expect(installs.getByText(/уведомления выключены/)).toBeInTheDocument();
  });

  it('shows scope texts from Backend and only narrows them', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    const access = within(await screen.findByRole('group', { name: 'Доступ nas' }));
    const friends = access.getByRole('switch', { name: /Друзья/ });
    expect(access.getByText('Видит список друзей')).toBeInTheDocument();
    expect(access.getByRole('switch', { name: /Расписание для друзей/ })).toBeDisabled();

    await userEvent.click(friends);

    expect(await screen.findByText('Доступ изменён')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: '/api/users/me/connections/00000000-0000-4000-8000-000000000601/scopes',
        csrf: '1',
        body: { scopes: ['sport'] },
      },
    ]);
    expect(friends).not.toBeChecked();
    // The last scope cannot go: a connection keeps at least one.
    expect(access.getByRole('switch', { name: /Запись на физкультуру/ })).toBeDisabled();
  });

  it('keeps the switch when narrowing fails', async () => {
    mockSession(userOf([]));
    mockDevices();
    server.use(
      http.put('*/api/users/me/connections/:id/scopes', () => fail(500, 'internal_server_error')),
    );
    renderApp('/me/devices');
    const access = within(await screen.findByRole('group', { name: 'Доступ nas' }));

    await userEvent.click(access.getByRole('switch', { name: /Друзья/ }));

    expect(await screen.findByText('Не удалось изменить доступ')).toBeInTheDocument();
    expect(access.getByRole('switch', { name: /Друзья/ })).toBeChecked();
  });

  it('revokes another connection after confirmation', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    await screen.findByText('nas');

    await userEvent.click(screen.getByRole('button', { name: 'Отключить nas' }));
    const dialog = await screen.findByRole('dialog', { name: 'Отключить nas?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отключить' }));

    expect(await screen.findByText('nas отключён')).toBeInTheDocument();
    await waitFor(() => expect(connections().queryByText('nas')).not.toBeInTheDocument());
    expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /api/users/me/connections/00000000-0000-4000-8000-000000000601/revoke',
    ]);
  });

  it('signs this browser out from its own row', async () => {
    let signedIn = true;
    mockSession(() => (signedIn ? userOf([]) : null));
    mockDevices();
    server.use(
      http.delete('*/api/client/self', () => {
        signedIn = false;
        return ok({});
      }),
    );
    mockChallenges('ABCDEFGH');
    mockClaim();
    renderApp('/me/devices');
    await screen.findByText('Этот браузер');

    await userEvent.click(screen.getByRole('button', { name: 'Выйти в этом браузере' }));
    const dialog = await screen.findByRole('dialog', { name: 'Выйти в этом браузере?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
  });

  it('signs out another install, which drops its pushes', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    await screen.findByText('Google Pixel 8');
    // The fixture's Pixel is `current`, as in the app's own answer: no sign-out on that row.
    expect(
      screen.queryByRole('button', { name: 'Выйти на Google Pixel 8' }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Выйти на iOS' }));
    const dialog = await screen.findByRole('dialog', { name: 'Выйти на iOS?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByText('Выход на iOS выполнен')).toBeInTheDocument();
    expect(calls.map(({ method, path }) => `${method} ${path}`)).toEqual([
      'POST /api/users/me/installs/00000000-0000-4000-8000-000000000702/sign-out',
    ]);
  });
});
