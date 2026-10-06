<script lang="ts">
  import { Icon, LoadingIndicator, revalidate, snackbars, StatusShape } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { fetchSync, POLL_MILLIS, startSync, SYNC_PATH } from './api';
  import { formatDateTime, formatNumber } from './format';
  import { SYNC_OUTCOMES } from './labels';
  import type { ReviewsSyncStatus } from './types';

  // The copy of teacher reviews from the Reviews project; polled quietly while a run goes.
  const sync = new Resource<ReviewsSyncStatus>(SYNC_PATH, fetchSync);
  void sync.load();

  let starting = $state(false);
  let failedPolls = $state(0);

  $effect(() => {
    void failedPolls;
    if (!sync.data?.running) return;
    const timer = setTimeout(() => {
      revalidate(SYNC_PATH, fetchSync, (data) => (sync.data = data)).catch(
        () => (failedPolls += 1),
      );
    }, POLL_MILLIS);
    return () => clearTimeout(timer);
  });

  async function start() {
    starting = true;
    try {
      sync.data = await startSync();
    } catch (error) {
      snackbars.error(
        errorText(error, 'Не удалось запустить синхронизацию', {
          business_rule_violation: 'Синхронизация уже идёт',
        }),
      );
      void sync.load();
    } finally {
      starting = false;
    }
  }

  const health = $derived.by(() => {
    const status = sync.data;
    if (!status) return null;
    if (!status.enabled) return { tone: 'off' as const, label: 'Выключена на сервере' };
    if (status.running) return { tone: 'warn' as const, label: 'Идёт синхронизация' };
    if (!status.lastOutcome) return { tone: 'off' as const, label: 'Ещё не запускалась' };
    return SYNC_OUTCOMES[status.lastOutcome];
  });
</script>

<section class="m3-card" aria-labelledby="reviews-sync">
  <header class="head">
    <h2 class="m3-section-title" id="reviews-sync">Синхронизация</h2>
    {#if sync.data}
      <button
        class="m3-btn tonal"
        onclick={start}
        disabled={!sync.data.enabled || sync.data.running || starting}
      >
        <Icon name="sync" />Синхронизировать
      </button>
    {/if}
  </header>
  {#if sync.data}
    {@const status = sync.data}
    <p class="state">
      {#if health}<span class="m3-label-large status"
          ><StatusShape tone={health.tone} />{health.label}</span
        >{/if}
      {#if status.lastCheckedAt}
        <span class="m3-body-small m3-muted">Проверено {formatDateTime(status.lastCheckedAt)}</span>
      {/if}
      {#if status.lastChangedAt}
        <span class="m3-body-small m3-muted">Изменения {formatDateTime(status.lastChangedAt)}</span>
      {/if}
    </p>
    {#if status.lastOutcome === 'FAILED' && status.lastError}
      <code class="m3-mono m3-body-small error">{status.lastError}</code>
    {/if}
    <dl class="stats">
      <div>
        <dt>отзывов</dt>
        <dd class="m3-num">{formatNumber(status.reviewsActive)}</dd>
      </div>
      <div>
        <dt>удалено</dt>
        <dd class="m3-num">{formatNumber(status.reviewsRemoved)}</dd>
      </div>
      <div>
        <dt>преподавателей</dt>
        <dd class="m3-num">{formatNumber(status.teachersActive)}</dd>
      </div>
    </dl>
    {#if status.lastChangedAt}
      <p class="m3-body-small m3-muted last">
        Последний запуск с изменениями: добавлено {formatNumber(status.lastAdded)}, изменено
        {formatNumber(status.lastUpdated)}, удалено {formatNumber(status.lastRemoved)}
      </p>
    {/if}
  {:else if sync.error}
    <LoadError
      error={sync.error}
      title="Не удалось загрузить синхронизацию"
      onretry={() => sync.load()}
    />
  {:else}
    <LoadingIndicator label="Загружаем синхронизацию" />
  {/if}
</section>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 12px;
  }
  .head h2 {
    margin: 0;
  }
  .state {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
    margin: 0 0 12px;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .error {
    display: block;
    margin-bottom: 12px;
    overflow-wrap: anywhere;
    color: var(--md-error);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
    margin: 0;
  }
  .stats div {
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-end;
    gap: 2px;
  }
  dd {
    margin: 0;
    font: var(--md-headline-small);
  }
  dt {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  .last {
    margin: 16px 0 0;
  }
</style>
