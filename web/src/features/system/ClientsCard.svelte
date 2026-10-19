<script lang="ts">
  import {
    ButtonGroup,
    EmptyState,
    Loadable,
    Meter,
    Resource,
    type GroupOption,
  } from '@alllexey/ui';
  import { CLIENT_KINDS, originLabel, platformLabel, type ClientKind } from '../../lib/clients';
  import { formatNumber } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { CLIENTS_PATH, fetchClients } from './api';
  import type { ClientBuildGroup, Clients, ClientKindStats } from './types';

  // Clients of signed-in users by their X-Client header: apps, the site and agents; forks and
  // self-built clients apart from official builds, under their upstream version.
  const clients = new Resource<Clients>(CLIENTS_PATH, fetchClients);
  void clients.load();
  let selected = $state<ClientKind>('ANDROID');

  $effect(() => {
    const kinds = clients.data?.kinds ?? [];
    const first = kinds[0];
    if (first && !kinds.some((stats) => stats.kind === selected)) selected = first.kind;
  });

  const options = (kinds: ClientKindStats[]): GroupOption<ClientKind>[] =>
    kinds.map((stats) => ({ value: stats.kind, label: CLIENT_KINDS[stats.kind].label }));
  const official = (stats: ClientKindStats) => stats.builds.filter((build) => !build.custom);
  const custom = (stats: ClientKindStats) => stats.builds.filter((build) => build.custom);
  const key = (build: ClientBuildGroup) =>
    `${build.custom}-${build.version}-${build.channel}-${build.source}`;
</script>

{#snippet builds(list: ClientBuildGroup[], max: number, label: string)}
  <ul class="m3-segmented" aria-label={label}>
    {#each list as build (key(build))}
      <li class="row">
        <span class="line">
          <span class="m3-title-small name">{build.version}</span>
          <span class="m3-title-small m3-num count">{formatNumber(build.active30d)}</span>
        </span>
        <span class="meter" aria-hidden="true"><Meter value={build.active30d} {max} /></span>
        <span class="m3-body-small m3-muted"
          >{originLabel(build.channel, build.source)} · за 7 дней: {formatNumber(
            build.active7d,
          )}</span
        >
      </li>
    {/each}
  </ul>
{/snippet}

<section class="m3-card card" aria-labelledby="system-client-stats">
  <header class="head">
    <h2 class="m3-section-title" id="system-client-stats">Клиенты</h2>
  </header>
  <p class="m3-body-medium m3-muted lead">
    Приложения, сайт и агенты вошедших пользователей за 30 дней; свои сборки — отдельно
  </p>
  <Loadable resource={clients} loadingLabel="Загружаем клиентов">
    {#snippet children(data)}
      {@const stats = data.kinds.find((item) => item.kind === selected) ?? data.kinds[0]}
      {#if !stats}
        <EmptyState
          icon="smartphone"
          title="Клиентов пока нет"
          text="Сюда попадают клиенты, которые присылают заголовок X-Client"
        />
      {:else}
        <dl class="stats">
          {#each data.kinds as item (item.kind)}
            <div>
              <dt>{CLIENT_KINDS[item.kind].label}</dt>
              <dd class="m3-num">{formatNumber(item.active30d)}</dd>
              <dd class="m3-num caption">
                7 дней: {formatNumber(item.active7d)} · сутки: {formatNumber(item.active1d)}
              </dd>
            </div>
          {/each}
        </dl>
        <ButtonGroup small label="Клиент" options={options(data.kinds)} bind:value={selected} />
        <h3 class="m3-title-small sub">Официальные сборки</h3>
        {#if official(stats).length === 0}
          <p class="m3-body-medium m3-muted">Нет</p>
        {:else}
          {@render builds(official(stats), stats.active30d, 'Официальные сборки')}
        {/if}
        {#if custom(stats).length > 0}
          <h3 class="m3-title-small sub">Свои сборки</h3>
          {@render builds(custom(stats), stats.active30d, 'Свои сборки')}
        {/if}
        <h3 class="m3-title-small sub">{stats.kind === 'WEB' ? 'Браузеры' : 'Системы'}</h3>
        <ul class="m3-segmented" aria-label={stats.kind === 'WEB' ? 'Браузеры' : 'Системы'}>
          {#each stats.platforms as platform (platform.name ?? '')}
            <li class="row">
              <span class="line">
                <span class="m3-title-small name">{platformLabel(stats.kind, platform.name)}</span>
                <span class="m3-title-small m3-num count">{formatNumber(platform.active30d)}</span>
              </span>
            </li>
          {/each}
        </ul>
      {/if}
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить клиентов" onretry={() => clients.load()} />
    {/snippet}
  </Loadable>
</section>

<style>
  .head {
    margin-bottom: 4px;
  }
  .head h2 {
    margin: 0;
  }
  .lead {
    margin: 0 0 16px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 120px), 1fr));
    gap: 12px;
    margin: 0 0 16px;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  dt {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  dd {
    margin: 0;
    font: var(--md-headline-small);
    font-variant-numeric: tabular-nums;
  }
  dd.caption {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  .sub {
    margin: 20px 0 8px;
  }
  .row {
    display: grid;
    gap: 6px;
    padding: 12px 16px;
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-width: 0;
  }
  .name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .count {
    margin-left: auto;
  }
</style>
