<script lang="ts">
  import { LoadingIndicator, LoadingOverlay } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { ApiError } from '../../api/client';
  import { counted } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { bookingsOf, bookingsPath } from './api';
  import { entryLesson, entryStatus } from './labels';

  // The person's sport: queue entries with their lessons. Confirmed bookings come as lesson IDs
  // without names, so they are only counted.
  let { isu, allowed }: { isu: number; allowed: boolean } = $props();
  // The page remounts the card when the person or the capability changes.
  const owner = untrack(() => isu);

  const bookings = new Resource(bookingsPath(owner), () => bookingsOf(owner));
  if (untrack(() => allowed)) void bookings.load();

  const denied = $derived(
    !allowed || (bookings.error instanceof ApiError && bookings.error.isForbidden),
  );
</script>

<section class="m3-card" aria-labelledby="person-sport">
  <h2 id="person-sport" class="m3-section-title">Спорт</h2>
  {#if denied}
    <p class="m3-muted">Спорт скрыт.</p>
  {:else if bookings.data}
    {@const { entries, lessonIds } = bookings.data}
    <LoadingOverlay loading={bookings.loading}>
      {#if entries.length === 0 && lessonIds.length === 0}
        <p class="m3-muted">Записей на спорт нет.</p>
      {:else}
        {#if entries.length > 0}
          <ul class="m3-segmented tiles" aria-label="Очереди на спорт">
            {#each entries as entry (`${entry.type}-${entry.id}`)}
              {@const lesson = entryLesson(entry)}
              <li class="m3-list-item">
                <span class="main">
                  <span class="headline">{lesson.section}</span>
                  <span class="support">{lesson.when} · {entryStatus(entry)}</span>
                </span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if lessonIds.length > 0}
          <p class="m3-body-medium confirmed" class:alone={entries.length === 0}>
            {entries.length > 0 ? 'И ещё ' : ''}{counted(lessonIds.length, [
              'подтверждённая запись',
              'подтверждённые записи',
              'подтверждённых записей',
            ])}
          </p>
        {/if}
      {/if}
    </LoadingOverlay>
  {:else if bookings.error}
    <LoadError
      error={bookings.error}
      title="Не удалось загрузить спорт"
      onretry={() => bookings.load()}
    />
  {:else}
    <div class="waiting"><LoadingIndicator label="Загружаем спорт" /></div>
  {/if}
</section>

<style>
  p {
    margin: 0;
  }
  .tiles {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tiles > :global(*) {
    background: var(--md-surface-container-lowest);
  }
  :global([data-theme='dark']) .tiles > :global(*) {
    background: var(--md-surface-container-high);
  }
  .confirmed {
    margin: 12px 4px 0;
    color: var(--md-on-surface-variant);
  }
  .confirmed.alone {
    margin: 0;
    color: inherit;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 96px;
  }
</style>
