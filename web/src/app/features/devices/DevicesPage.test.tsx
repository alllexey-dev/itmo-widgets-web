import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { formatDate } from '../../lib/format';
import { devicesBackend, devicesOf } from '../../test/account';
import { findToast, renderApp } from '../../test/render';
import {
  fail,
  mockChallenges,
  mockClaim,
  mockSession,
  ok,
  server,
  userOf,
} from '../../test/server';

const NAS = '00000000-0000-4000-8000-000000000601';
const PIXEL = '00000000-0000-4000-8000-000000000701';

/** The devices list and its changes, answered like Backend; returns the changing requests. */
function mockDevices(devices = devicesOf()) {
  const backend = devicesBackend(devices);
  server.use(...backend.handlers);
  return backend.calls;
}

async function connections() {
  return within(await screen.findByRole('list', { name: 'Подключённые' }));
}

function installs() {
  return within(screen.getByRole('list', { name: 'Телефоны с приложением' }));
}

async function accessOf(name: string) {
  return within(await screen.findByRole('group', { name: `Доступ ${name}` }));
}

/** The golden devices: the iPhone's notifications were turned off from another device. */
function goldenDevices() {
  const devices = devicesOf();
  const [, iphone] = devices.installs;
  if (!iphone) throw new Error('The fixture has an iPhone');
  iphone.signedOutAt = '2026-10-04T12:00:00Z';
  return devices;
}

/** The golden devices with the Pixel as another phone, not the calling one. */
function devicesWithOtherPhone() {
  const devices = goldenDevices();
  const [pixel] = devices.installs;
  if (!pixel) throw new Error('The fixture has a Pixel');
  pixel.current = false;
  return devices;
}

describe('DevicesPage', () => {
  it('lists live connections with this browser marked and the app installs', async () => {
    mockSession(userOf([]));
    mockDevices(goldenDevices());

    renderApp('/me/devices');

    const rows = await connections();
    expect(screen.getByRole('heading', { level: 1, name: 'Устройства' })).toBeInTheDocument();
    expect(rows.getByText('nas')).toBeInTheDocument();
    expect(rows.getByText('Chrome, macOS')).toBeInTheDocument();
    expect(rows.getByText('Этот браузер')).toBeInTheDocument();
    // A revoked connection waits for the phone to end its ITMO session; it is not shown.
    expect(rows.queryByText('MacBook Air')).not.toBeInTheDocument();
    expect(installs().getByText('Google Pixel 8')).toBeInTheDocument();
    expect(installs().getByText('ITMO.Widgets 2.4.0, Android API 36')).toBeInTheDocument();
    // Turned off from another device: Backend forgot the model, so it is named by its platform,
    // and the row says when; there is nothing left to turn off.
    expect(installs().getByText('iPhone')).toBeInTheDocument();
    expect(
      installs().getByText(/· уведомления отключены 4 окт\. с сайта или другого телефона$/),
    ).toBeInTheDocument();
    expect(installs().queryByRole('button')).not.toBeInTheDocument();
  });

  it('links back to the profile', async () => {
    mockSession(userOf([]));
    mockDevices();

    renderApp('/me/devices');
    await connections();

    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Профиль' })).toHaveAttribute(
      'href',
      '/app/me',
    );
  });

  it('says what a connection is and what a closed ITMO sign-in means for it', async () => {
    mockSession(userOf([]));
    const devices = devicesOf();
    const [agent, browser] = devices.connections;
    if (!agent || !browser) throw new Error('The fixture has an agent and a browser');
    agent.itmoStatus = 'closed';
    agent.lastUsedAt = null;
    mockDevices(devices);

    renderApp('/me/devices');

    const rows = (await connections()).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent(/Программа на компьютере \(агент\) · подключено 1 окт\./);
    expect(rows[0]).toHaveTextContent('Вход в ИТМО закрыт');
    expect(rows[0]).toHaveTextContent(
      'nas не может обращаться к My ITMO. Чтобы вернуть доступ, войдите заново в приложении: Профиль → Устройства → nas.',
    );
    expect(rows[1]).toHaveTextContent(/Браузер · активность 5 окт\./);
    expect(rows[1]).not.toHaveTextContent('Вход в ИТМО');
  });

  it('warns when the ITMO sign-in of a client ends within a week and says what to do', async () => {
    mockSession(userOf([]));
    const devices = devicesOf();
    const [agent] = devices.connections;
    if (!agent?.itmo) throw new Error('The agent of the fixture has an ITMO session');
    agent.itmo.expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString();
    mockDevices(devices);

    renderApp('/me/devices');

    const rows = await connections();
    expect(rows.getByText(/^Вход в ИТМО до \d+ /)).toBeInTheDocument();
    expect(
      rows.getByText(
        'Потом nas не сможет обращаться к My ITMO. Обновите вход в приложении: Профиль → Устройства → nas.',
      ),
    ).toBeInTheDocument();
  });

  it('shows scope texts from Backend and takes a scope away after a confirmation', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    const access = await accessOf('nas');
    expect(access.getByText('Видит список друзей')).toBeInTheDocument();

    await userEvent.click(access.getByRole('button', { name: 'Убрать доступ: Друзья' }));
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Убрать доступ «Друзья» у nas?',
    });
    expect(dialog).toHaveTextContent(
      'Вернуть доступ можно только в приложении: Профиль → Устройства → nas.',
    );
    expect(calls).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Убрать доступ' }));

    expect(await findToast('Доступ убран')).toBeInTheDocument();
    expect(calls).toEqual([
      {
        method: 'PUT',
        path: `/api/users/me/connections/${NAS}/scopes`,
        csrf: '1',
        body: { scopes: ['sport'] },
      },
    ]);
    // The last scope cannot go: a connection keeps at least one.
    await waitFor(() => expect(access.queryByRole('button')).not.toBeInTheDocument());
    expect(access.getByText(/^Последний доступ убрать нельзя/)).toBeInTheDocument();
  });

  it('keeps the scope when the confirmation is cancelled', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    const access = await accessOf('nas');

    await userEvent.click(access.getByRole('button', { name: 'Убрать доступ: Друзья' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Отмена' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls).toEqual([]);
    expect(access.getByRole('button', { name: 'Убрать доступ: Друзья' })).toBeInTheDocument();
  });

  it('offers nothing that looks reversible: no switches, no way to add a scope', async () => {
    mockSession(userOf([]));
    mockDevices();

    renderApp('/me/devices');

    const access = await accessOf('nas');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(access.getByText('нет доступа')).toBeInTheDocument();
    expect(access.queryByRole('button', { name: /Расписание для друзей/ })).not.toBeInTheDocument();
    expect(
      access.getByText(
        'Убранный доступ отсюда не вернуть: добавить его можно только в приложении.',
      ),
    ).toBeInTheDocument();
    // A browser's scope is fixed: it lists none.
    expect(screen.queryByRole('group', { name: 'Доступ Chrome, macOS' })).not.toBeInTheDocument();
  });

  it('keeps the scope when taking it away fails', async () => {
    mockSession(userOf([]));
    mockDevices();
    server.use(
      http.put('*/api/users/me/connections/:id/scopes', () => fail(500, 'internal_server_error')),
    );
    renderApp('/me/devices');
    const access = await accessOf('nas');

    await userEvent.click(access.getByRole('button', { name: 'Убрать доступ: Друзья' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Убрать доступ' }),
    );

    expect(await findToast('Не удалось убрать доступ')).toBeInTheDocument();
    expect(access.getByRole('button', { name: 'Убрать доступ: Друзья' })).toBeEnabled();
  });

  it('revokes another connection after confirmation', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    const rows = await connections();

    await userEvent.click(rows.getByRole('button', { name: 'Отключить nas' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Отключить nas?' });
    expect(dialog).toHaveTextContent('Доступ к ITMO.Widgets закончится сразу');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отключить' }));

    expect(await findToast('nas отключён')).toBeInTheDocument();
    await waitFor(() => expect(rows.queryByText('nas')).not.toBeInTheDocument());
    expect(calls).toEqual([
      { method: 'POST', path: `/api/users/me/connections/${NAS}/revoke`, csrf: '1' },
    ]);
  });

  it('names another browser in its confirmation, not "this browser"', async () => {
    mockSession(userOf([]));
    const devices = devicesOf();
    const [, browser] = devices.connections;
    if (!browser) throw new Error('The fixture has a browser');
    devices.connections.push({
      ...browser,
      id: '00000000-0000-4000-8000-000000000605',
      name: 'Safari, iOS',
    });
    mockDevices(devices);
    renderApp('/me/devices');
    const rows = await connections();

    await userEvent.click(rows.getByRole('button', { name: 'Отключить Safari, iOS' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Отключить Safari, iOS?' });
    expect(dialog).toHaveTextContent('Safari, iOS сразу выйдет из ITMO.Widgets.');
    expect(dialog).not.toHaveTextContent('Этот браузер');
  });

  it('keeps the connection when the confirmation is cancelled or revoking fails', async () => {
    mockSession(userOf([]));
    const calls = mockDevices();
    renderApp('/me/devices');
    const rows = await connections();

    await userEvent.click(rows.getByRole('button', { name: 'Отключить nas' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Отмена' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls).toEqual([]);

    server.use(
      http.post('*/api/users/me/connections/:id/revoke', () => fail(503, 'service_unavailable')),
    );
    await userEvent.click(rows.getByRole('button', { name: 'Отключить nas' }));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Отключить' }),
    );

    expect(await findToast('Не удалось отключить устройство')).toBeInTheDocument();
    expect(rows.getByText('nas')).toBeInTheDocument();
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
    const rows = await connections();

    await userEvent.click(rows.getByRole('button', { name: 'Выйти в этом браузере' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Выйти в этом браузере?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Выйти' }));

    expect(await screen.findByRole('img', { name: 'QR-код для входа' })).toBeInTheDocument();
    expect(location.pathname).toBe('/app/login');
  });

  it('turns the notifications of another phone off, and the row shows it', async () => {
    mockSession(userOf([]));
    const calls = mockDevices(devicesWithOtherPhone());
    renderApp('/me/devices');
    await connections();

    await userEvent.click(
      installs().getByRole('button', { name: 'Отключить уведомления на Google Pixel 8' }),
    );
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Отключить уведомления на Google Pixel 8?',
    });
    expect(dialog).toHaveTextContent(
      'Вход в ИТМО на нём останется: завершить его можно только в приложении на другом телефоне (Профиль → Устройства).',
    );
    expect(dialog).toHaveTextContent(
      'Вместе с ними остановится запись на спорт через этот телефон.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Отключить уведомления' }));

    expect(await findToast('Уведомления на Google Pixel 8 отключены')).toBeInTheDocument();
    expect(calls).toEqual([
      { method: 'POST', path: `/api/users/me/installs/${PIXEL}/sign-out`, csrf: '1' },
    ]);
    // Backend keeps the install without its model and marks when it was turned off; the row shows
    // what Backend has, so it reads the same after the page is opened again.
    await waitFor(() => expect(installs().queryByRole('button')).not.toBeInTheDocument());
    const today = formatDate(new Date());
    expect(installs().getByText('Телефон на Android')).toBeInTheDocument();
    expect(installs().queryByText('Google Pixel 8')).not.toBeInTheDocument();
    expect(
      installs().getByText(
        `Активность 5 окт. · уведомления отключены ${today} с сайта или другого телефона`,
      ),
    ).toBeInTheDocument();
  });

  it('shows a phone turned off from here the same when the page is opened again', async () => {
    mockSession(userOf([]));
    mockDevices(devicesWithOtherPhone());
    const { unmount } = renderApp('/me/devices');
    await connections();
    await userEvent.click(
      installs().getByRole('button', { name: 'Отключить уведомления на Google Pixel 8' }),
    );
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Отключить уведомления',
      }),
    );
    await findToast('Уведомления на Google Pixel 8 отключены');
    unmount();

    renderApp('/me/devices');
    await connections();

    expect(installs().getByText('Телефон на Android')).toBeInTheDocument();
    expect(
      installs().getByText(
        `Активность 5 окт. · уведомления отключены ${formatDate(new Date())} с сайта или другого телефона`,
      ),
    ).toBeInTheDocument();
    expect(installs().queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers nothing on the calling phone and on one without a push registration', async () => {
    mockSession(userOf([]));
    mockDevices();

    renderApp('/me/devices');
    await connections();

    // The fixture's Pixel is `current`, as in the app's own answer; its iPhone has no registration.
    expect(installs().getByText('iPhone')).toBeInTheDocument();
    expect(installs().queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Телефоны с приложением' })).toHaveTextContent(
      'Отсюда можно только отключить уведомления на телефоне. Вместе с ними остановится запись на спорт через этот телефон.',
    );
  });

  it('tells a phone that turned its notifications off from one without a registration', async () => {
    mockSession(userOf([]));
    const devices = devicesOf();
    const [, iphone] = devices.installs;
    if (!iphone) throw new Error('The fixture has an iPhone');
    iphone.deviceName = 'iPhone 15';
    iphone.signedOutAt = null;
    mockDevices(devices);

    renderApp('/me/devices');
    await connections();

    expect(installs().getByText(/уведомления выключены на телефоне$/)).toBeInTheDocument();
    const button = installs().getByRole('button', { name: 'Отключить уведомления на iPhone 15' });
    expect(button).toHaveTextContent(/^Отключить уведомления$/);

    await userEvent.click(button);

    // The dialog says what the button still does for such a phone.
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Уведомления сейчас выключены на самом телефоне. Если отключить их и здесь, они не придут, даже когда на телефоне их включат снова, — пока приложение не подключит их заново.',
    );
  });

  it('says when a phone never turned its notifications on', async () => {
    mockSession(userOf([]));
    const devices = devicesWithOtherPhone();
    const [pixel] = devices.installs;
    if (!pixel) throw new Error('The fixture has a Pixel');
    pixel.deviceName = null;
    pixel.pushEnabled = false;
    pixel.signedOutAt = null;
    mockDevices(devices);

    renderApp('/me/devices');
    await connections();

    expect(installs().getByText('Телефон на Android')).toBeInTheDocument();
    expect(installs().getByText(/· уведомления не включены$/)).toBeInTheDocument();
    expect(installs().queryByRole('button')).not.toBeInTheDocument();
  });

  it('keeps the phone as it is when turning its notifications off fails', async () => {
    mockSession(userOf([]));
    mockDevices(devicesWithOtherPhone());
    server.use(
      http.post('*/api/users/me/installs/:id/sign-out', () => fail(503, 'service_unavailable')),
    );
    renderApp('/me/devices');
    await connections();

    await userEvent.click(
      installs().getByRole('button', { name: 'Отключить уведомления на Google Pixel 8' }),
    );
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Отключить уведомления',
      }),
    );

    expect(await findToast('Не удалось отключить уведомления')).toBeInTheDocument();
    expect(installs().getByText('Google Pixel 8')).toBeInTheDocument();
  });

  it('says so when there are no phones with the app', async () => {
    mockSession(userOf([]));
    mockDevices({ ...devicesOf(), installs: [] });

    renderApp('/me/devices');

    await connections();
    expect(screen.getByText('Нет телефонов с приложением')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Телефоны с приложением' })).not.toBeInTheDocument();
  });

  it('offers a retry when the devices do not load', async () => {
    mockSession(userOf([]));
    mockDevices();
    let attempts = 0;
    server.use(
      http.get('*/api/users/me/devices', () => {
        attempts += 1;
        return attempts === 1 ? fail(503, 'service_unavailable') : ok(devicesOf());
      }),
    );
    renderApp('/me/devices');
    expect(await screen.findByText('Не удалось загрузить устройства')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));

    expect((await connections()).getByText('nas')).toBeInTheDocument();
  });
});
