<script lang="ts">
  import {
    ConfirmDialog,
    Icon,
    Loadable,
    PageHeader,
    Resource,
    snackbars,
    Switch,
  } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import { formatRelative } from '../../lib/format';
  import { href } from '../../lib/router.svelte';
  import { session } from '../../lib/session.svelte';
  import { devices, DEVICES_PATH, revoke, signOutInstall, updateScopes } from './api';
  import { clientOf, connectionLine, installLine, installName, itmoProblem } from './labels';
  import type { Connection, Install, ScopeId } from './types';

  // The Backend part of «Устройства» in the app, the lost-phone path: connected clients with their access
  // and the app installs. ITMO.ID sessions stay on the phone, which ends them after a revoke.
  const list = new Resource(DEVICES_PATH, devices);
  void list.load();

  const self = $derived(session.user?.connection.id);
  let confirming = $state<{ connection: Connection } | { install: Install } | null>(null);
  let busy = $state(false);
  let saving = $state<string | null>(null);

  function replace(connection: Connection) {
    if (!list.data) return;
    list.data = {
      ...list.data,
      connections: list.data.connections.map((row) =>
        row.id === connection.id ? connection : row,
      ),
    };
  }

  // The switch stays put until Backend answers; the answer sets it.
  function narrow(connection: Connection, scope: ScopeId): false {
    const scopes = connection.scopes
      .filter((grant) => grant.granted && grant.scope.id !== scope)
      .map((grant) => grant.scope.id);
    saving = connection.id;
    updateScopes(connection.id, scopes)
      .then(
        (updated) => {
          replace(updated);
          snackbars.show('Доступ изменён');
        },
        (error: unknown) => snackbars.error(errorText(error, 'Не удалось изменить доступ')),
      )
      .finally(() => (saving = null));
    return false;
  }

  const dialog = $derived.by(() => {
    if (!confirming) return null;
    if ('install' in confirming) {
      return {
        title: `Выйти на ${installName(confirming.install)}?`,
        text: 'Уведомления на него больше не придут. Вход в ИТМО на нём завершается в приложении на другом телефоне: Профиль → Устройства.',
        confirmLabel: 'Выйти',
      };
    }
    const { connection } = confirming;
    if (connection.id === self) {
      return {
        title: 'Выйти в этом браузере?',
        text: 'Чтобы войти снова, понадобится телефон с приложением.',
        confirmLabel: 'Выйти',
      };
    }
    return {
      title: `Отключить ${connection.name}?`,
      text:
        connection.client === 'web'
          ? 'Этот браузер сразу выйдет из ITMO.Widgets.'
          : 'Доступ к ITMO.Widgets закончится сразу. Вход в ИТМО на нём завершит телефон, когда вы откроете «Устройства» в приложении.',
      confirmLabel: 'Отключить',
    };
  });

  async function confirm() {
    const target = confirming;
    if (!target) return;
    busy = true;
    try {
      if ('install' in target) {
        await signOutInstall(target.install.instanceId);
        snackbars.show(`Выход на ${installName(target.install)} выполнен`);
      } else if (target.connection.id === self) {
        // Goes to the login page.
        await session.logout();
        return;
      } else {
        await revoke(target.connection.id);
        snackbars.show(`${target.connection.name} отключён`);
      }
      confirming = null;
      void list.load();
    } catch (error) {
      snackbars.error(errorText(error, 'Не удалось выполнить действие'));
    } finally {
      busy = false;
    }
  }
</script>

<PageHeader
  title="Устройства"
  text="Подключённые браузеры, агенты и MCP, телефоны с приложением"
  back={{ href: href('/me'), label: 'Профиль' }}
/>

<Loadable
  resource={list}
  loadingLabel="Загружаем устройства"
  errorTitle="Не удалось загрузить устройства"
>
  {#snippet children(data)}
    {@const connections = data.connections.filter((connection) => !connection.revokedAt)}
    <div class="grid">
      <section class="m3-card" aria-labelledby="devices-connections">
        <h2 id="devices-connections" class="m3-section-title">Подключённые</h2>
        {#if connections.length === 0}
          <p class="m3-muted">Нет подключённых клиентов</p>
        {:else}
          <ul class="m3-list divided plain" aria-label="Подключённые">
            {#each connections as connection (connection.id)}
              {@const client = clientOf(connection)}
              {@const problem = itmoProblem(connection)}
              {@const own = connection.id === self}
              {@const granted = connection.scopes.filter((grant) => grant.granted).length}
              <li class="connection">
                <div class="m3-list-item wrap">
                  <span class="lead"><Icon name={client.icon} /></span>
                  <span class="main">
                    <span class="headline">{connection.name}</span>
                    <span class="support">{connectionLine(connection)}</span>
                    {#if own || problem}
                      <span class="pills">
                        {#if own}<span class="m3-pill primary">Этот браузер</span>{/if}
                        {#if problem}<span class="m3-pill {problem.tone}">{problem.label}</span
                          >{/if}
                      </span>
                    {/if}
                  </span>
                  <span class="trail">
                    <button
                      class="m3-btn outlined small"
                      onclick={() => (confirming = { connection })}
                      aria-label={own ? 'Выйти в этом браузере' : `Отключить ${connection.name}`}
                    >
                      {own ? 'Выйти' : 'Отключить'}
                    </button>
                  </span>
                </div>
                {#if connection.client !== 'web'}
                  <div class="scopes" role="group" aria-label="Доступ {connection.name}">
                    {#each connection.scopes as grant (grant.scope.id)}
                      <Switch
                        checked={grant.granted}
                        disabled={!grant.granted || granted === 1 || saving === connection.id}
                        onchange={() => narrow(connection, grant.scope.id)}
                      >
                        <span class="scope">
                          <span class="m3-body-large">{grant.scope.title}</span>
                          <span class="m3-body-medium m3-muted">{grant.scope.description}</span>
                        </span>
                      </Switch>
                    {/each}
                    <p class="m3-body-small m3-muted">Добавить доступ можно только в приложении</p>
                  </div>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>

      <section class="m3-card" aria-labelledby="devices-installs">
        <h2 id="devices-installs" class="m3-section-title">Телефоны с приложением</h2>
        {#if data.installs.length === 0}
          <p class="m3-muted">Нет телефонов</p>
        {:else}
          <ul class="m3-list divided plain" aria-label="Телефоны с приложением">
            {#each data.installs as install (install.instanceId)}
              <li class="m3-list-item wrap">
                <span class="lead"><Icon name="smartphone" /></span>
                <span class="main">
                  <span class="headline">{installName(install)}</span>
                  <span class="support">{installLine(install)}</span>
                  <span class="support">
                    Активность {formatRelative(install.lastSeenAt)}{install.pushEnabled
                      ? ''
                      : ', уведомления выключены'}
                  </span>
                </span>
                {#if !install.current}
                  <span class="trail">
                    <button
                      class="m3-btn outlined small"
                      onclick={() => (confirming = { install })}
                      aria-label="Выйти на {installName(install)}"
                    >
                      Выйти
                    </button>
                  </span>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>
  {/snippet}
</Loadable>

{#if dialog}
  <ConfirmDialog
    title={dialog.title}
    text={dialog.text}
    confirmLabel={dialog.confirmLabel}
    danger
    {busy}
    onconfirm={confirm}
    oncancel={() => (confirming = null)}
  />
{/if}

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  p {
    margin: 0;
  }
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .scopes {
    display: grid;
    gap: 12px;
    padding: 0 0 16px 56px;
  }
  .scope {
    display: grid;
    gap: 2px;
  }
</style>
