<script lang="ts">
  import { Icon, Loadable, Resource } from '@alllexey/ui';
  import { formatNumber } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { href } from '../../lib/router.svelte';
  import { dashboard } from './api';

  // "За 7 дней" for the admin: three headline numbers and the way to "Статистика".
  const week = new Resource(dashboard.key, dashboard.fetch);
  void week.load();
</script>

<section class="m3-card week" aria-labelledby="week-title">
  <h2 id="week-title" class="m3-section-title">За 7 дней</h2>
  <Loadable resource={week} loadingLabel="Загружаем сводку">
    {#snippet children({ totals })}
      <dl class="numbers">
        <div>
          <dt>Новые пользователи</dt>
          <dd class="m3-num">+{formatNumber(totals.newUsers7d)}</dd>
        </div>
        <div>
          <dt>Активные устройства</dt>
          <dd class="m3-num">{formatNumber(totals.activeDevices7d)}</dd>
        </div>
        <div>
          <dt>Входы на сайт</dt>
          <dd class="m3-num">{formatNumber(totals.webSessions7d)}</dd>
        </div>
      </dl>
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить сводку" onretry={() => week.load()} />
    {/snippet}
  </Loadable>
  <a class="m3-btn tonal more" href={href('/admin/dashboard')}>
    Статистика
    <Icon name="arrow_forward" size={18} />
  </a>
</section>

<style>
  .week {
    display: flex;
    flex-direction: column;
  }
  .numbers {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin: 0 0 16px;
  }
  .numbers dt {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .numbers dd {
    margin: 4px 0 0;
    font: var(--md-headline-medium);
  }
  .more {
    align-self: flex-start;
    margin-top: auto;
  }
  @media (max-width: 520px) {
    .numbers {
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .numbers div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
    .numbers dd {
      font: var(--md-headline-small);
    }
  }
</style>
