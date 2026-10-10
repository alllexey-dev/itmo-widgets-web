<script lang="ts">
  import {
    ConfirmDialog,
    EmptyState,
    forget,
    Icon,
    Loadable,
    PageHeader,
    Resource,
    snackbars,
  } from '@alllexey/ui';
  import { api, ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import { buildLabel, channelLabel } from '../../lib/appBuild';
  import { formatDate, formatDateTime, formatNumber, formatRelative } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { href, router } from '../../lib/router.svelte';
  import type { Role } from '../../lib/session.svelte';
  import {
    CAPABILITIES,
    groupLine,
    platformCounts,
    platformLabel,
    restrictionState,
  } from './labels';
  import ModeratorSwitch from './ModeratorSwitch.svelte';
  import RoleBadges from './RoleBadges.svelte';
  import type { AdminRestriction, AdminUserDetail } from './types';

  // One user for the admin: access, activity, devices with their platform, groups and restrictions.
  const isu = router.route.name === 'user' ? router.route.isu : 0;
  const path = `/api/admin/users/${isu}`;
  const user = new Resource(path, () => api.get<AdminUserDetail>(path));
  void user.load();

  const missing = $derived(user.error instanceof ApiError && user.error.code === 'not_found');

  function rolesChanged(roles: Role[]) {
    if (user.data) user.data = { ...user.data, roles };
    // The list shows roles, the audit records the change.
    forget('/api/admin/users');
    forget('/api/admin/audit');
  }

  let revoking = $state<AdminRestriction | null>(null);
  async function revoke() {
    const restriction = revoking;
    revoking = null;
    if (!restriction) return;
    try {
      await api.post<null>(`/api/admin/moderation/restrictions/${restriction.id}/revoke`);
      snackbars.show('Ограничение снято');
      forget('/api/admin/moderation');
      forget(path);
      await user.load();
    } catch (error) {
      snackbars.error(errorText(error, 'Не удалось снять ограничение'));
    }
  }
</script>

<a class="m3-btn text back" href={href('/admin/users')}>
  <Icon name="arrow_back" size={18} />
  Пользователи
</a>

<Loadable resource={user} loadingLabel="Загружаем пользователя">
  {#snippet children(data)}
    {@const detail = data}
    {@const current = detail.user.groups[0]}
    <div class="head">
      <PageHeader
        title={detail.user.name}
        text={`ИСУ ${detail.user.isu}${current ? ` · ${groupLine(current)}` : ''}`}
      >
        {#snippet actions()}<RoleBadges roles={detail.roles} />{/snippet}
      </PageHeader>
    </div>

    <div class="layout">
      <section class="m3-card" aria-labelledby="user-access">
        <h2 id="user-access" class="m3-section-title">Доступ</h2>
        <ModeratorSwitch
          isu={detail.user.isu}
          name={detail.user.name}
          roles={detail.roles}
          onchanged={rolesChanged}
        />
      </section>

      <dl class="stats">
        <div class="m3-card">
          <dt>Последняя активность</dt>
          <dd>{detail.lastSeen ? formatRelative(detail.lastSeen) : '—'}</dd>
          {#if detail.lastSeen}<dd class="m3-muted caption">
              {formatDateTime(detail.lastSeen)}
            </dd>{/if}
        </div>
        <div class="m3-card">
          <dt>Регистрация</dt>
          <dd>{formatDate(detail.createdAt)}</dd>
        </div>
        <div class="m3-card">
          <dt>Друзья</dt>
          <dd class="m3-num">{formatNumber(detail.friendsCount)}</dd>
        </div>
        <div class="m3-card">
          <dt>Ссылки</dt>
          <dd class="m3-num">{formatNumber(detail.linksCount)}</dd>
        </div>
      </dl>

      <div class="columns">
        <section class="m3-card" aria-labelledby="user-devices">
          <h2 id="user-devices" class="m3-section-title">Устройства</h2>
          {#if detail.devices.length === 0}
            <p class="m3-muted">Нет устройств</p>
          {:else}
            <p class="m3-muted counts">{platformCounts(detail.devices)}</p>
            <ul class="m3-list divided plain" aria-label="Устройства">
              {#each detail.devices as device, index (`${device.name}-${device.lastLogin}-${index}`)}
                <li class="m3-list-item device">
                  <span class="lead"><Icon name="smartphone" /></span>
                  <span class="main">
                    <span class="headline">{device.name}</span>
                    <span class="support">
                      {platformLabel(device)} · {device.appVersion
                        ? buildLabel(device.appVersion, device.appBuild)
                        : 'версия: нет данных'}{device.appDistribution
                        ? ` · ${channelLabel(device.appDistribution)}`
                        : ''}
                    </span>
                    {#if device.appVersionSeenAt}
                      <span class="support" title={formatDateTime(device.appVersionSeenAt)}>
                        Активно {formatRelative(device.appVersionSeenAt)}
                      </span>
                    {/if}
                  </span>
                  <span class="trail">{formatDateTime(device.lastLogin)}</span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>

        <section class="m3-card" aria-labelledby="user-groups">
          <h2 id="user-groups" class="m3-section-title">Группы</h2>
          {#if detail.groups.length === 0}
            <p class="m3-muted">Групп нет</p>
          {:else}
            <ul class="m3-list plain">
              {#each detail.groups as group (group.name)}
                <li class="m3-list-item">
                  <span class="lead"><Icon name="school" /></span>
                  <span class="main"><span class="headline">{groupLine(group)}</span></span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>

      <section class="m3-card" aria-labelledby="user-restrictions">
        <h2 id="user-restrictions" class="m3-section-title">Ограничения</h2>
        {#if detail.restrictions.length === 0}
          <p class="m3-muted">Ограничений не было</p>
        {:else}
          <ul class="m3-list divided plain" aria-label="Ограничения пользователя">
            {#each detail.restrictions as restriction (restriction.id)}
              {@const state = restrictionState(restriction)}
              {@const end = restriction.revokedAt ?? restriction.expiresAt}
              <li class="m3-list-item restriction">
                <span class="lead"><Icon name="block" /></span>
                <span class="main">
                  <span class="headline">{CAPABILITIES[restriction.capability]}</span>
                  <span class="support">{restriction.reason}</span>
                  <span class="support">
                    {end
                      ? `${formatDate(restriction.startsAt)} — ${formatDate(end)}`
                      : `с ${formatDate(restriction.startsAt)}, бессрочно`}
                  </span>
                </span>
                <span class="trail actions">
                  <span class="m3-pill {state.tone}">{state.label}</span>
                  {#if restriction.active}
                    <button class="m3-btn text" onclick={() => (revoking = restriction)}
                      >Снять</button
                    >
                  {/if}
                </span>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    </div>

    {#if revoking}
      <ConfirmDialog
        title="Снять ограничение?"
        text={`${detail.user.name} снова сможет: ${CAPABILITIES[revoking.capability].toLowerCase()}.`}
        confirmLabel="Снять"
        onconfirm={revoke}
        oncancel={() => (revoking = null)}
      />
    {/if}
  {/snippet}
  {#snippet failed(error)}
    {#if missing}
      <section class="m3-card">
        <EmptyState icon="person_off" title="Пользователь не найден" text="Проверьте номер ИСУ" />
      </section>
    {:else}
      <section class="m3-card">
        <LoadError {error} title="Не удалось загрузить пользователя" onretry={() => user.load()} />
      </section>
    {/if}
  {/snippet}
</Loadable>

<style>
  .back {
    margin: -8px 0 8px -12px;
  }
  /* A long name breaks inside a word rather than widening the page on a phone. */
  .head :global(h1) {
    overflow-wrap: anywhere;
  }
  .layout {
    display: grid;
    gap: 16px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
    gap: 12px;
    margin: 0;
  }
  .stats dt {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .stats dd {
    margin: 4px 0 0;
    font: var(--md-headline-small);
  }
  .stats .caption {
    font: var(--md-body-small);
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr));
    gap: 16px;
  }
  .plain {
    margin: 0 -16px;
    padding: 0;
    list-style: none;
  }
  .counts {
    margin: -4px 0 8px;
  }
  p {
    margin: 0;
  }
  .restriction .support,
  .device .support {
    white-space: normal;
  }
  .actions {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 4px;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 40vh;
  }
  @media (max-width: 520px) {
    .restriction {
      flex-wrap: wrap;
    }
    .restriction .actions {
      width: 100%;
      justify-content: flex-start;
      padding-left: 40px;
    }
  }
</style>
