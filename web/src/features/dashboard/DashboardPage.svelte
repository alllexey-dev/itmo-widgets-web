<script lang="ts">
  import { Icon, Loadable, LoadingOverlay, Meter, PageHeader, Resource } from '@alllexey/ui';
  import { api } from '../../api/client';
  import { formatDate, formatNumber } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { href } from '../../lib/router.svelte';
  import TrendCard from './TrendCard.svelte';
  import type { Dashboard, DayMetric, LinkStatus } from './types';

  // "Статистика": a drill-down from Главная (the rail keeps Главная active), totals, 30-day charts and
  // the daily table they are drawn from.
  const dashboard = new Resource('/api/admin/dashboard', () =>
    api.get<Dashboard>('/api/admin/dashboard'),
  );
  void dashboard.load();

  const TRENDS: { metric: DayMetric; title: string }[] = [
    { metric: 'newUsers', title: 'Новые пользователи' },
    { metric: 'activeDevices', title: 'Активные устройства' },
    { metric: 'createdLinks', title: 'Новые ссылки' },
  ];

  const LINK_STATUSES: { status: LinkStatus; label: string }[] = [
    { status: 'PUBLISHED', label: 'Опубликованы' },
    { status: 'PENDING', label: 'На проверке' },
    { status: 'REJECTED', label: 'Отклонены' },
    { status: 'HIDDEN', label: 'Скрыты' },
    { status: 'PRIVATE', label: 'Личные' },
  ];

  const data = $derived(dashboard.data);
  const links = $derived(
    LINK_STATUSES.map((item) => ({ ...item, count: data?.totals.links[item.status] ?? 0 })),
  );
  const linksTotal = $derived(links.reduce((sum, item) => sum + item.count, 0));
  const linksMax = $derived(Math.max(1, ...links.map((item) => item.count)));
  const newestFirst = $derived(data ? [...data.days].reverse() : []);
</script>

<PageHeader
  title="Статистика"
  text="Итоги и последние 30 дней"
  back={{ href: href('/'), label: 'Главная' }}
/>

<Loadable resource={dashboard} loadingLabel="Загружаем статистику">
  {#snippet children(data)}
    {@const totals = data.totals}
    <LoadingOverlay loading={dashboard.loading}>
      <div class="tiles">
        <div class="m3-card tile" role="group" aria-label="Пользователи">
          <span class="m3-label-large m3-muted">Пользователи</span>
          <p class="value m3-num">{formatNumber(totals.users)}</p>
          <p class="m3-muted">+{formatNumber(totals.newUsers7d)} за 7 дней</p>
        </div>
        <div class="m3-card tile" role="group" aria-label="Активные устройства">
          <span class="m3-label-large m3-muted">Активные устройства</span>
          <p class="value m3-num">{formatNumber(totals.activeDevices7d)}</p>
          <p class="m3-muted">за 7 дней · {formatNumber(totals.activeDevices30d)} за 30</p>
        </div>
        <div class="m3-card tile" role="group" aria-label="Входы на сайт">
          <span class="m3-label-large m3-muted">Входы на сайт</span>
          <p class="value m3-num">{formatNumber(totals.webSessions7d)}</p>
          <p class="m3-muted">за 7 дней</p>
        </div>
        <div class="m3-card tile" role="group" aria-label="Дружбы">
          <span class="m3-label-large m3-muted">Дружбы</span>
          <p class="value m3-num">{formatNumber(totals.friendships)}</p>
        </div>
        <div class="m3-card tile" role="group" aria-label="Очереди спорта">
          <span class="m3-label-large m3-muted">Очереди спорта</span>
          <p class="value m3-num">
            {formatNumber(totals.activeAutoSignEntries + totals.activeFreeSignEntries)}
          </p>
          <p class="m3-muted">
            авто {formatNumber(totals.activeAutoSignEntries)} · свободная
            {formatNumber(totals.activeFreeSignEntries)}
          </p>
        </div>
        <a class="m3-card primary tile cases" href={href('/admin/moderation')}>
          <span class="m3-label-large">Открытые заявки</span>
          <span class="value m3-num">{formatNumber(totals.openCases)}</span>
          <span class="go">В очередь <Icon name="arrow_forward" size={18} /></span>
        </a>
      </div>

      <div class="charts">
        {#each TRENDS as trend (trend.metric)}
          <TrendCard days={data.days} metric={trend.metric} title={trend.title} />
        {/each}
        <section class="m3-card" aria-label="Ссылки по состоянию">
          <h2 class="m3-title-medium">Ссылки по состоянию</h2>
          <p class="m3-muted m3-num sub">{formatNumber(linksTotal)} всего</p>
          <ul class="bars">
            {#each links as item (item.status)}
              <li>
                <span class="label">{item.label}</span>
                <span class="meter" aria-hidden="true"
                  ><Meter value={item.count} max={linksMax} /></span
                >
                <span class="m3-num count">{formatNumber(item.count)}</span>
              </li>
            {/each}
          </ul>
        </section>
      </div>

      <details class="m3-card days">
        <summary class="m3-title-small">
          <Icon name="table" size={20} />
          Данные по дням
        </summary>
        <div class="m3-table" role="table" aria-label="Данные по дням">
          <div class="tr th" role="row">
            <span role="columnheader">День</span>
            {#each TRENDS as trend (trend.metric)}
              <span role="columnheader" class="end">{trend.title}</span>
            {/each}
          </div>
          {#each newestFirst as day (day.date)}
            <div class="tr" role="row">
              <span role="cell">{formatDate(day.date)}</span>
              {#each TRENDS as trend (trend.metric)}
                <span role="cell" class="end m3-num">{formatNumber(day[trend.metric])}</span>
              {/each}
            </div>
          {/each}
        </div>
      </details>
    </LoadingOverlay>
  {/snippet}
  {#snippet failed(error)}
    <section class="m3-card">
      <LoadError {error} title="Не удалось загрузить статистику" onretry={() => dashboard.load()} />
    </section>
  {/snippet}
</Loadable>

<style>
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .tile p {
    margin: 0;
  }
  .value {
    font: var(--md-headline-medium);
  }
  .cases .go {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: auto;
    font: var(--md-label-large);
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 420px), 1fr));
    gap: 16px;
    margin-bottom: 16px;
  }
  .charts h2 {
    margin: 0;
  }
  .sub {
    margin: 4px 0 12px;
  }
  .bars {
    display: grid;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .bars li {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr) 48px;
    align-items: center;
    gap: 12px;
  }
  .label {
    font: var(--md-body-medium);
  }
  .count {
    text-align: right;
  }
  .days {
    padding: 0;
    overflow: hidden;
  }
  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: 0 24px;
    cursor: pointer;
  }
  summary:focus-visible {
    outline: 3px solid var(--md-secondary);
    outline-offset: -3px;
  }
  .days .tr {
    grid-template-columns: minmax(96px, 1fr) repeat(3, minmax(120px, 1fr));
    min-width: 520px;
  }
  .end {
    text-align: right;
  }
</style>
