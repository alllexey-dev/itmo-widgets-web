<script lang="ts">
  import {
    ConfirmDialog,
    EmptyState,
    forget,
    Loadable,
    LoadingIndicator,
    Meter,
    PageHeader,
    Resource,
    snackbars,
  } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import { counted } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { autoSignLimits, ENTRIES_KEY, leaveQueue, LIMITS_PATH, myEntries } from './api';
  import EntryRow from './EntryRow.svelte';
  import { activeEntries, formatDay, lessonOf, pastEntries } from './labels';
  import type { QueueEntry } from './types';

  // The user's own sport queues. Getting into a queue needs the lesson list of My ITMO, so it stays
  // in the app; here the user sees the queues, leaves one and checks the auto-sign limit.
  const RECENT = 5;

  const entries = new Resource(ENTRIES_KEY, myEntries);
  const limits = new Resource(LIMITS_PATH, autoSignLimits);
  void entries.load();
  void limits.load();

  const active = $derived(entries.data ? activeEntries(entries.data) : []);
  const recent = $derived(entries.data ? pastEntries(entries.data, RECENT) : []);

  let leaving = $state<QueueEntry | null>(null);
  let pending = $state<number | null>(null);

  async function leave() {
    const entry = leaving;
    leaving = null;
    if (!entry) return;
    pending = entry.id;
    try {
      await leaveQueue(entry);
      snackbars.show('Вы вышли из очереди');
      forget('/api/sport');
      await Promise.all([entries.load(), limits.load()]);
    } catch (error) {
      snackbars.error(errorText(error, 'Не удалось выйти из очереди'));
    } finally {
      pending = null;
    }
  }
</script>

<PageHeader
  title="Спорт"
  text="Очереди, в которых вы стоите. Встать в очередь можно в приложении."
/>

<div class="grid">
  <section class="m3-card" aria-labelledby="sport-active">
    <h2 id="sport-active" class="m3-section-title">
      В очереди
      {#if entries.data}<span class="count m3-num">{active.length}</span>{/if}
    </h2>
    <Loadable resource={entries} loadingLabel="Загружаем очереди">
      {#if active.length > 0}
        <ul class="m3-segmented" aria-label="Очереди">
          {#each active as entry (`${entry.type}-${entry.id}`)}
            <EntryRow {entry} busy={pending === entry.id} onleave={(item) => (leaving = item)} />
          {/each}
        </ul>
        <p class="m3-body-small m3-muted note">
          Когда место освобождается, приложение записывает вас само — телефон должен быть в сети.
        </p>
      {:else}
        <EmptyState
          icon="fitness_center"
          title="Вы не стоите в очередях"
          text="Встать в очередь на занятие можно в приложении."
        />
      {/if}
      {#snippet failed(error)}
        <LoadError {error} title="Не удалось загрузить очереди" onretry={() => entries.load()} />
      {/snippet}
    </Loadable>
  </section>

  <div class="stack">
    <section class="m3-card" aria-labelledby="sport-limits">
      <h2 id="sport-limits" class="m3-section-title">Автозапись</h2>
      <Loadable resource={limits} loadingLabel="Загружаем лимит">
        {#snippet children(data)}
          {@const used = Math.max(0, data.limit - data.available)}
          <div class="spread">
            <span class="m3-body-large">Занято {used} из {data.limit}</span>
            {#if data.available === 0}
              <span class="m3-body-medium m3-muted">
                следующая — около {formatDay(new Date(data.nextAvailableAt))}
              </span>
            {:else}
              <span class="m3-body-medium m3-muted">
                свободно {counted(data.available, ['место', 'места', 'мест'])}
              </span>
            {/if}
          </div>
          <div class="meter"><Meter value={used} max={Math.max(1, data.limit)} /></div>
          <p class="m3-body-small m3-muted note">
            Считаются очереди, которые ждут, и попытки записи за 30 дней.
          </p>
        {/snippet}
        {#snippet failed(error)}
          <LoadError {error} title="Не удалось загрузить лимит" onretry={() => limits.load()} />
        {/snippet}
      </Loadable>
    </section>

    <section class="m3-card" aria-labelledby="sport-recent">
      <h2 id="sport-recent" class="m3-section-title">Недавние</h2>
      {#if entries.data}
        {#if recent.length > 0}
          <ul class="m3-segmented" aria-label="Недавние очереди">
            {#each recent as entry (`${entry.type}-${entry.id}`)}
              <EntryRow {entry} />
            {/each}
          </ul>
        {:else}
          <p class="m3-muted">Здесь появятся очереди, которые закончились.</p>
        {/if}
      {:else if entries.error}
        <p class="m3-muted">Не удалось загрузить</p>
      {:else}
        <div class="waiting small"><LoadingIndicator label="Загружаем недавние очереди" /></div>
      {/if}
    </section>
  </div>
</div>

{#if leaving}
  {@const lesson = lessonOf(leaving)}
  <ConfirmDialog
    title="Выйти из очереди?"
    text={`${lesson.section}, ${formatDay(lesson.start)}. Место в очереди не сохранится.`}
    confirmLabel="Выйти"
    onconfirm={leave}
    oncancel={() => (leaving = null)}
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
  .stack {
    display: grid;
    gap: 16px;
  }
  h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .count {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .note {
    margin: 12px 4px 0;
  }
  .spread {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 4px 12px;
  }
  .meter {
    margin-top: 12px;
  }
  p {
    margin: 0;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 160px;
  }
  .waiting.small {
    min-height: 96px;
  }
</style>
