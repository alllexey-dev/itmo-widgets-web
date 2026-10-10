<script lang="ts">
  import { Loadable, Resource, StatusShape } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { fetchSport, SPORT_PATH } from './api';
  import { formatDateTime, formatDuration, formatNumber, formatRelative } from './format';
  import { SPORT_ERRORS, SPORT_HEALTH, SPORT_OUTCOMES } from './labels';
  import type { SportErrorCategory, SportRun, SportStatus } from './types';

  // The catalogue refresh of sport lessons and the entries waiting for auto-enrolment.
  // `focused` moves focus (and the scroll) here once the data is in: /admin/sport opens Система here.
  let { focused = false }: { focused?: boolean } = $props();

  const SHOWN_RUNS = 5;
  const sport = new Resource<SportStatus>(SPORT_PATH, fetchSport);
  void sport.load();

  let heading: HTMLHeadingElement;
  let allRuns = $state(false);
  let moved = false;
  $effect(() => {
    if (!focused || moved || (!sport.data && !sport.error)) return;
    moved = true;
    heading.focus();
  });

  const count = (value: number | undefined) => value ?? 0;
  const latest = $derived(sport.data?.runs[0]);
  const runs7d = $derived(
    sport.data
      ? count(sport.data.outcomes7d.SUCCESS) +
          count(sport.data.outcomes7d.PARTIAL) +
          count(sport.data.outcomes7d.FAILED)
      : 0,
  );
  const errors = $derived(
    sport.data
      ? (Object.keys(SPORT_ERRORS) as SportErrorCategory[])
          .map((category) => ({ category, count: count(sport.data?.errors7d[category]) }))
          .filter((error) => error.count > 0)
      : [],
  );
  const errorTotal = $derived(errors.reduce((sum, error) => sum + error.count, 0));
  const shown = $derived(
    sport.data ? (allRuns ? sport.data.runs : sport.data.runs.slice(0, SHOWN_RUNS)) : [],
  );

  function runText(run: SportRun): string {
    if (run.errorCategory) return `Ошибка: ${SPORT_ERRORS[run.errorCategory]}`;
    return `Получено ${formatNumber(run.receivedLessons)}, новых ${formatNumber(run.newLessonsAdded)}, изменено ${formatNumber(run.updatedLessons)}`;
  }
</script>

<section class="m3-card" id="sport" aria-labelledby="system-sport">
  <header class="head">
    <h2 class="m3-section-title" id="system-sport" tabindex="-1" bind:this={heading}>
      Автозапись на спорт
    </h2>
    {#if sport.data}
      <span class="m3-label-large">
        {#if latest}
          <StatusShape tone={SPORT_OUTCOMES[latest.outcome].tone}
            >{SPORT_HEALTH[latest.outcome]}</StatusShape
          >
        {:else}
          <StatusShape tone="neutral">Запусков не было</StatusShape>
        {/if}
      </span>
    {/if}
  </header>
  <Loadable resource={sport} loadingLabel="Загружаем автозапись">
    {#snippet children(status)}
      <dl class="stats">
        <div>
          <dt>последний успешный запуск</dt>
          <dd title={status.lastSuccessAt ? formatDateTime(status.lastSuccessAt) : undefined}>
            {status.lastSuccessAt ? formatRelative(status.lastSuccessAt) : 'Не было'}
          </dd>
        </div>
        <div>
          <dt>запусков за 7 дней</dt>
          <dd class="m3-num">{formatNumber(runs7d)}</dd>
        </div>
        <div>
          <dt>
            {errorTotal === 0
              ? 'ошибок за 7 дней'
              : errors
                  .map((error) => `${SPORT_ERRORS[error.category].toLowerCase()}: ${error.count}`)
                  .join(', ')}
          </dt>
          <dd class="m3-num">{formatNumber(errorTotal)}</dd>
        </div>
        <div>
          <dt>в среднем за запуск</dt>
          <dd class="m3-num">
            {status.averageDurationMillis7d === null
              ? '—'
              : formatDuration(status.averageDurationMillis7d)}
          </dd>
        </div>
        <div>
          <dt>ждут автозаписи</dt>
          <dd class="m3-num">{formatNumber(status.activeAutoSignEntries)}</dd>
        </div>
        <div>
          <dt>ждут свободного места</dt>
          <dd class="m3-num">{formatNumber(status.activeFreeSignEntries)}</dd>
        </div>
      </dl>
      {#if status.runs.length === 0}
        <p class="m3-muted">Запусков ещё не было</p>
      {:else}
        <ul class="m3-segmented" aria-label="Последние запуски">
          {#each shown as run (run.id)}
            {@const outcome = SPORT_OUTCOMES[run.outcome]}
            <li class="run">
              <StatusShape tone={outcome.tone} label={outcome.label} />
              <span class="main">
                <span class="m3-title-small">{formatDateTime(run.timestamp)}</span>
                <span class="m3-body-small m3-muted">{runText(run)}</span>
              </span>
              <span class="m3-num m3-body-small m3-muted">{formatDuration(run.durationMillis)}</span
              >
            </li>
          {/each}
        </ul>
        {#if status.runs.length > SHOWN_RUNS}
          <button class="m3-btn text more" onclick={() => (allRuns = !allRuns)}>
            {allRuns ? 'Свернуть' : `Все запуски (${status.runs.length})`}
          </button>
        {/if}
      {/if}
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить автозапись" onretry={() => sport.load()} />
    {/snippet}
  </Loadable>
</section>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 16px;
  }
  .head h2 {
    margin: 0;
    scroll-margin-top: 96px;
  }
  .head h2:focus-visible {
    outline: 3px solid var(--md-secondary);
    outline-offset: 4px;
    border-radius: var(--md-shape-sm);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
    margin: 0 0 20px;
  }
  .stats div {
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-end;
    gap: 2px;
    min-width: 0;
  }
  dd {
    margin: 0;
    font: var(--md-headline-small);
  }
  dt {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  .run {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
  }
  .main {
    display: grid;
    flex: 1;
    min-width: 0;
  }
  .main span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .more {
    margin-top: 8px;
  }
</style>
