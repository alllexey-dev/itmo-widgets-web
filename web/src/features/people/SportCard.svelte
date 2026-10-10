<script lang="ts">
  import { Loadable, Resource } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { ApiError } from '../../api/client';
  import { counted } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
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
  {:else}
    <Loadable resource={bookings} loadingLabel="Загружаем спорт">
      {#snippet children(data)}
        {@const { entries, lessonIds } = data}
        {#if entries.length === 0 && lessonIds.length === 0}
          <p class="m3-muted">Записей на спорт нет.</p>
        {:else}
          {#if entries.length > 0}
            <ul class="m3-segmented" aria-label="Очереди на спорт">
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
      {/snippet}
      {#snippet failed(error)}
        <LoadError {error} title="Не удалось загрузить спорт" onretry={() => bookings.load()} />
      {/snippet}
    </Loadable>
  {/if}
</section>

<style>
  p {
    margin: 0;
  }
  .confirmed {
    margin: 12px 4px 0;
    color: var(--md-on-surface-variant);
  }
  .confirmed.alone {
    margin: 0;
    color: inherit;
  }
</style>
