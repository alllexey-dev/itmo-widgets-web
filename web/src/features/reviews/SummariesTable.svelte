<script lang="ts">
  import { EmptyState, Icon, Loadable, Resource, Tabs, type TabOption } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import LoadError from '../../lib/LoadError.svelte';
  import { router } from '../../lib/router.svelte';
  import { PAGE_SIZE, teachersRequest } from './api';
  import { formatDateTime, formatNumber } from './format';
  import { SUMMARY_LEVELS, SUMMARY_STATUSES, teacherLabel } from './labels';
  import SummaryDialog from './SummaryDialog.svelte';
  import type { SummaryStatus, TeacherPage, TeacherSummaryRow } from './types';

  // Teachers with a summary status; `status` and `page` live in the URL. A row opens its summary.
  let {
    enabled,
    running,
    onchanged,
  }: {
    /** Summaries are on at the server. */
    enabled: boolean;
    /** A run is going; the table reloads once it ends, since a run changes the statuses. */
    running: boolean;
    onchanged: () => void;
  } = $props();

  const FILTERS: TabOption<SummaryStatus | 'ALL'>[] = [
    { value: 'ALL', label: 'Все' },
    { value: 'READY', label: 'Готовы' },
    { value: 'PENDING', label: 'В очереди' },
    { value: 'FAILED', label: 'Ошибки' },
    { value: 'HIDDEN', label: 'Скрыты' },
  ];

  const status = $derived(
    FILTERS.find((filter) => filter.value !== 'ALL' && filter.value === router.query.get('status'))
      ?.value ?? 'ALL',
  );
  const page = $derived(Math.max(0, Math.floor(Number(router.query.get('page'))) || 0));

  const first = teachersRequest(null, 0);
  const teachers = new Resource<TeacherPage>(first.key, first.fetch);
  $effect(() => {
    const next = teachersRequest(status === 'ALL' ? null : status, page);
    void teachers.load(next.key, next.fetch);
  });

  let wasRunning = untrack(() => running);
  $effect(() => {
    if (wasRunning && !running) void teachers.load();
    wasRunning = running;
  });

  let open = $state<TeacherSummaryRow | null>(null);
  const pages = $derived(
    teachers.data ? Math.max(1, Math.ceil(teachers.data.total / PAGE_SIZE)) : 1,
  );

  function changed() {
    onchanged();
    void teachers.load();
  }

  function pick(next: SummaryStatus | 'ALL') {
    router.setQuery({ status: next === 'ALL' ? null : next, page: null });
  }

  function turn(next: number) {
    router.setQuery({ page: next > 0 ? next : null });
  }
</script>

<section class="m3-card flush" aria-labelledby="reviews-teachers">
  <h2 class="m3-section-title title" id="reviews-teachers">Сводки преподавателей</h2>
  <Tabs label="Статус сводки" options={FILTERS} value={status} onchange={pick} />
  <Loadable resource={teachers} loadingLabel="Загружаем сводки преподавателей">
    {#snippet children(list)}
      {#if list.items.length === 0}
        <EmptyState icon="inbox" title="Сводок пока нет" />
      {:else}
        <div class="m3-table" role="table" aria-label="Сводки преподавателей">
          <div class="tr th" role="row">
            <span role="columnheader">Преподаватель</span>
            <span role="columnheader">Статус</span>
            <span role="columnheader" class="end">Отзывов</span>
            <span role="columnheader">Тон</span>
            <span role="columnheader">Построена</span>
            <span role="columnheader">Ошибка</span>
          </div>
          {#each list.items as row (row.teacherIsu)}
            {@const rowStatus = SUMMARY_STATUSES[row.status]}
            <div class="tr row" role="row">
              <span role="cell" class="m3-clip">
                <button class="open" title={teacherLabel(row)} onclick={() => (open = row)}
                  >{teacherLabel(row)}</button
                >
              </span>
              <span role="cell"
                ><span class="m3-pill {rowStatus.pill}">{rowStatus.label}</span></span
              >
              <span role="cell" class="end m3-num">{formatNumber(row.inputCount)}</span>
              <span role="cell">{row.summary ? SUMMARY_LEVELS[row.summary.level] : '—'}</span>
              <span role="cell" class="m3-num">
                {row.summary ? formatDateTime(row.summary.generatedAt) : '—'}
              </span>
              <span role="cell" class="m3-clip">
                {#if row.lastError}<code class="m3-mono m3-body-small" title={row.lastError}
                    >{row.lastError}</code
                  >{:else}—{/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}
      {#if list.total > PAGE_SIZE}
        <nav class="pager" aria-label="Страницы">
          <span class="m3-body-medium m3-muted">Страница {page + 1} из {pages}</span>
          <button
            class="m3-icon-btn"
            aria-label="Предыдущая страница"
            disabled={page === 0}
            onclick={() => turn(page - 1)}><Icon name="chevron_left" /></button
          >
          <button
            class="m3-icon-btn"
            aria-label="Следующая страница"
            disabled={page + 1 >= pages}
            onclick={() => turn(page + 1)}><Icon name="chevron_right" /></button
          >
        </nav>
      {/if}
    {/snippet}
    {#snippet failed(error)}
      <LoadError
        {error}
        title="Не удалось загрузить сводки преподавателей"
        onretry={() => teachers.load()}
      />
    {/snippet}
  </Loadable>
</section>

{#if open}
  <SummaryDialog row={open} {enabled} onchanged={changed} onclose={() => (open = null)} />
{/if}

<style>
  .title {
    padding: 20px 24px 0;
  }
  .tr {
    grid-template-columns: minmax(200px, 2fr) 104px 80px minmax(150px, 1.4fr) 128px minmax(
        120px,
        1fr
      );
    min-width: 860px;
  }
  .row {
    position: relative;
    isolation: isolate;
  }
  /* The teacher button covers its row: the whole row opens the summary, and it stays one button. */
  .open {
    border: none;
    background: none;
    padding: 0;
    color: inherit;
    font: var(--md-title-small);
    text-align: left;
    cursor: pointer;
  }
  .open::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
  }
  .open:focus-visible {
    outline: none;
  }
  .row:has(.open:focus-visible) {
    outline: 3px solid var(--md-secondary);
    outline-offset: -3px;
  }
  @media (hover: hover) {
    .row:hover {
      background: color-mix(in srgb, var(--md-on-surface) 6%, transparent);
    }
  }
  .end {
    text-align: right;
  }
  .pager {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 8px 16px;
    border-top: 1px solid var(--md-outline-variant);
  }
  .pager span {
    margin-right: 8px;
  }
  .pad {
    padding: 0 24px 24px;
  }
</style>
