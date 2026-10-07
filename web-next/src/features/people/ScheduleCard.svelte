<script lang="ts">
  import { LoadingIndicator, LoadingOverlay } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { ApiError } from '../../api/client';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { lessonsOf, lessonsPath } from './api';
  import { byDay, clock, formatDayTitle, lessonPlace, nextDays } from './labels';
  import type { Lesson } from './types';

  // The schedule the person's app uploaded, for the next week. Asked only when the audience admits the
  // viewer; a 403 in between (the owner just closed it) reads as hidden too.
  const DAYS = 7;
  let { isu, allowed }: { isu: number; allowed: boolean } = $props();
  // The page remounts the card when the person or the capability changes.
  const owner = untrack(() => isu);

  const range = nextDays(DAYS);
  const lessons = new Resource<Lesson[]>(
    `${lessonsPath(owner)}?from=${range.from}&to=${range.to}`,
    () => lessonsOf(owner, range.from, range.to),
  );
  if (untrack(() => allowed)) void lessons.load();

  const denied = $derived(
    !allowed || (lessons.error instanceof ApiError && lessons.error.isForbidden),
  );
  const days = $derived(lessons.data ? byDay(lessons.data) : []);
</script>

<section class="m3-card" aria-labelledby="person-schedule">
  <div class="head">
    <h2 id="person-schedule" class="m3-section-title">Расписание</h2>
    {#if !denied}<span class="m3-body-small m3-muted">ближайшие 7 дней</span>{/if}
  </div>
  {#if denied}
    <p class="m3-muted">Расписание скрыто.</p>
  {:else if lessons.data}
    <LoadingOverlay loading={lessons.loading}>
      {#if days.length === 0}
        <p class="m3-muted">На ближайшие 7 дней занятий нет.</p>
      {:else}
        {#each days as day (day.date)}
          <h3 class="day m3-title-small">{formatDayTitle(day.date)}</h3>
          <ul class="m3-segmented tiles" aria-label={formatDayTitle(day.date)}>
            {#each day.lessons as lesson (lesson.pairId)}
              <li class="m3-list-item lesson">
                <span class="lead time m3-num">
                  <span>{clock(lesson.start)}</span>
                  <span class="until">{clock(lesson.end)}</span>
                </span>
                <span class="main">
                  <span class="headline">{lesson.subjectName}</span>
                  <span class="support">{lessonPlace(lesson)}</span>
                </span>
              </li>
            {/each}
          </ul>
        {/each}
      {/if}
    </LoadingOverlay>
  {:else if lessons.error}
    <LoadError
      error={lessons.error}
      title="Не удалось загрузить расписание"
      onretry={() => lessons.load()}
    />
  {:else}
    <div class="waiting"><LoadingIndicator label="Загружаем расписание" /></div>
  {/if}
</section>

<style>
  .head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }
  p {
    margin: 0;
  }
  .day {
    margin: 16px 4px 8px;
  }
  .day:first-child {
    margin-top: 4px;
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
  .time {
    display: flex;
    flex-direction: column;
    width: 48px;
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .until {
    font: var(--md-label-medium);
  }
  .lesson .headline,
  .lesson .support {
    white-space: normal;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 120px;
  }
</style>
