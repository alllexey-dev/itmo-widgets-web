<script lang="ts">
  import { Icon, LoadingIndicator } from '@alllexey/ui';
  import { formatNumber } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href } from '../../lib/router.svelte';
  import { dashboard } from './api';

  // "За 7 дней" for the admin: three headline numbers and the way to "Статистика".
  const data = new Resource(dashboard.key, dashboard.fetch);
  void data.load();
  const totals = $derived(data.data?.totals);
</script>

<section class="m3-card week" aria-labelledby="week-title">
  <h2 id="week-title" class="m3-section-title">За 7 дней</h2>
  {#if totals}
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
  {:else if data.error}
    <LoadError error={data.error} title="Не удалось загрузить сводку" onretry={() => data.load()} />
  {:else}
    <div class="waiting"><LoadingIndicator label="Загружаем сводку" /></div>
  {/if}
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
  .waiting {
    display: grid;
    place-items: center;
    min-height: 96px;
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
