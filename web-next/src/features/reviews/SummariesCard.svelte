<script lang="ts">
  import { ConfirmDialog, Icon, LoadingIndicator, snackbars, StatusShape } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import type { Resource } from '../../lib/resource.svelte';
  import { href } from '../../lib/router.svelte';
  import { startSummaries } from './api';
  import { formatDateTime, formatDay, formatNumber } from './format';
  import { RUN_OUTCOMES, RUN_TRIGGERS } from './labels';
  import type { AiSummariesState } from './types';

  // The night run and "Пересчитать всё"; the page polls the state while a run goes.
  let { summaries }: { summaries: Resource<AiSummariesState> } = $props();

  let confirming = $state(false);
  let starting = $state(false);

  async function start() {
    confirming = false;
    starting = true;
    try {
      summaries.data = await startSummaries();
    } catch (error) {
      snackbars.error(
        errorText(error, 'Не удалось запустить пересчёт', {
          business_rule_violation: 'Пересчёт уже идёт',
        }),
      );
      void summaries.load();
    } finally {
      starting = false;
    }
  }

  const health = $derived.by(() => {
    const state = summaries.data;
    if (!state) return null;
    if (!state.enabled) return { tone: 'off' as const, label: 'Выключены на сервере' };
    if (state.running) return { tone: 'warn' as const, label: 'Идёт пересчёт' };
    if (!state.lastOutcome) return { tone: 'off' as const, label: 'Ещё не запускался' };
    return RUN_OUTCOMES[state.lastOutcome];
  });
  const remaining = $derived(
    summaries.data ? Math.max(0, summaries.data.dailyBudget - summaries.data.budgetUsed) : 0,
  );
</script>

<section class="m3-card" aria-labelledby="reviews-ai">
  <header class="head">
    <div>
      <h2 class="m3-section-title" id="reviews-ai">ИИ-сводки</h2>
      {#if summaries.data?.model}
        <p class="m3-body-medium m3-muted model">Gemini · {summaries.data.model}</p>
      {/if}
    </div>
    {#if summaries.data}
      <button
        class="m3-btn tonal"
        onclick={() => (confirming = true)}
        disabled={!summaries.data.enabled ||
          summaries.data.keyStatus === 'MISSING' ||
          summaries.data.running ||
          starting}
      >
        Пересчитать всё
      </button>
    {/if}
  </header>
  {#if summaries.data}
    {@const state = summaries.data}
    {@const failedRun = state.lastOutcome !== null && state.lastOutcome !== 'COMPLETED'}
    {@const keyBroken = state.keyStatus === 'FAILED' || state.keyStatus === 'EXPIRED'}
    <p class="state">
      {#if health}<span class="m3-label-large status"
          ><StatusShape tone={health.tone} />{health.label}</span
        >{/if}
      {#if state.lastStartedAt}
        <span class="m3-body-small m3-muted">
          Запуск {formatDateTime(state.lastStartedAt)}{state.lastTrigger
            ? ` · ${RUN_TRIGGERS[state.lastTrigger]}`
            : ''}
        </span>
      {/if}
    </p>
    {#if !state.running && failedRun && state.lastError}
      <code class="m3-mono m3-body-small error">{state.lastError}</code>
    {/if}
    {#if state.keyStatus === 'MISSING' || keyBroken}
      <p class="m3-card warning notice">
        <Icon name="key" size={20} />
        <span>{keyBroken ? 'Ключ Gemini не принят' : 'Ключ Gemini не задан'}</span>
        <a href={href('/admin/system')}>Ключи и доступы</a>
      </p>
    {/if}
    <dl class="stats">
      <div>
        <dt>готовы</dt>
        <dd class="m3-num">{formatNumber(state.ready)}</dd>
      </div>
      <div>
        <dt>в очереди</dt>
        <dd class="m3-num">{formatNumber(state.pending)}</dd>
      </div>
      <div>
        <dt>ошибки</dt>
        <dd class="m3-num">{formatNumber(state.failed)}</dd>
      </div>
      <div>
        <dt>скрыты</dt>
        <dd class="m3-num">{formatNumber(state.hidden)}</dd>
      </div>
      <div>
        <dt>запросов за {formatDay(state.budgetDay)}</dt>
        <dd class="m3-num">
          {formatNumber(state.budgetUsed)} из {formatNumber(state.dailyBudget)}
        </dd>
      </div>
    </dl>
    {#if state.lastFinishedAt}
      <p class="m3-body-small m3-muted last">
        Последний запуск: построено {formatNumber(state.lastGenerated)}, отклонено
        {formatNumber(state.lastFailed)}, запросов {formatNumber(state.lastRequests)}
      </p>
    {/if}
  {:else if summaries.error}
    <LoadError
      error={summaries.error}
      title="Не удалось загрузить сводки"
      onretry={() => summaries.load()}
    />
  {:else}
    <LoadingIndicator label="Загружаем сводки" />
  {/if}
</section>

{#if confirming}
  <ConfirmDialog
    title="Пересчитать сводки?"
    text="Только преподаватели с изменившимися отзывами. Осталось запросов сегодня: {formatNumber(
      remaining,
    )}."
    confirmLabel="Пересчитать"
    onconfirm={start}
    oncancel={() => (confirming = false)}
  />
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 12px;
  }
  .head h2 {
    margin: 0;
  }
  .model {
    margin: 4px 0 0;
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
  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin: 0 0 16px;
    padding: 12px 16px;
  }
  .notice a {
    color: inherit;
    font: var(--md-label-large);
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
