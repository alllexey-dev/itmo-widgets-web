<script lang="ts">
  import {
    ButtonGroup,
    type ChipOption,
    Chips,
    EmptyState,
    Loadable,
    Resource,
  } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { router } from '../../lib/router.svelte';
  import { casesKey, fetchCases, prefetchCase, QUEUE_PAGE_SIZE, type CaseFilter } from './api';
  import CaseDetail from './CaseDetail.svelte';
  import CaseList from './CaseList.svelte';
  import { REASONS } from './labels';
  import Pagination from './Pagination.svelte';
  import { shortcuts } from './shortcuts.svelte';
  import type { AdminCaseItem, AdminPage, CaseReason, CaseStatus, ModerationCase } from './types';

  // The queue and the open case. `status`, `reason`, `page` and `case` live in the query string; picking a
  // case replaces the history entry. Wide screens show both panes and open the first case by themselves,
  // phones show the list first and the case instead of it.
  let { wide, ondecided }: { wide: boolean; ondecided: () => void } = $props();

  const REASON_VALUES = Object.keys(REASONS) as CaseReason[];
  const REASON_OPTIONS: ChipOption<CaseReason | 'ALL'>[] = [
    { value: 'ALL', label: 'Все' },
    ...REASON_VALUES.map((value) => ({ value, label: REASONS[value].label })),
  ];
  const STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
    { value: 'OPEN', label: 'Открытые' },
    { value: 'RESOLVED', label: 'Решённые' },
  ];

  const status = $derived<CaseStatus>(
    router.query.get('status') === 'RESOLVED' ? 'RESOLVED' : 'OPEN',
  );
  const reason = $derived.by<CaseReason | null>(() => {
    const value = router.query.get('reason') as CaseReason | null;
    return value && REASON_VALUES.includes(value) ? value : null;
  });
  const page = $derived.by(() => {
    const value = Number(router.query.get('page'));
    return Number.isInteger(value) && value > 0 ? value : 0;
  });
  const requestedId = $derived(router.query.get('case'));

  const filter = (): CaseFilter => ({ status, reason, page });
  const cases = new Resource<AdminPage<AdminCaseItem>>(casesKey(filter()), () =>
    fetchCases(filter()),
  );
  const key = $derived(casesKey({ status, reason, page }));
  $effect(() => {
    void cases.load(key, () => fetchCases(filter()));
  });

  const items = $derived(cases.data?.items ?? []);
  const selectedId = $derived(requestedId ?? (wide ? (items[0]?.id ?? null) : null));
  const selectedIndex = $derived(items.findIndex((item) => item.id === selectedId));
  const nextId = $derived(items[selectedIndex + 1]?.id ?? null);

  $effect(() => {
    if (nextId) prefetchCase(nextId);
  });

  function select(id: string | null) {
    router.setQuery({ case: id });
  }

  function setFilter(changes: Record<string, string | null>) {
    router.setQuery({ ...changes, page: null, case: null });
  }

  function move(step: number) {
    const target = items[selectedIndex < 0 ? 0 : selectedIndex + step];
    if (target) select(target.id);
  }

  shortcuts(() => (items.length > 0 ? { KeyJ: () => move(1), KeyK: () => move(-1) } : {}));

  /** A resolved case leaves the open queue: go on to its neighbour. */
  function decided(updated: ModerationCase) {
    if (status === 'OPEN' && updated.status !== 'OPEN') {
      const neighbour = items[selectedIndex + 1] ?? items[selectedIndex - 1] ?? null;
      select(neighbour?.id ?? null);
    }
    void cases.load();
    ondecided();
  }
</script>

<div class="toolbar">
  <ButtonGroup
    small
    label="Состояние заявок"
    options={STATUS_OPTIONS}
    value={status}
    onchange={(value) => setFilter({ status: value === 'OPEN' ? null : value })}
  />
  <Chips
    label="Причина"
    options={REASON_OPTIONS}
    bind:value={
      () => reason ?? 'ALL', (next) => next && setFilter({ reason: next === 'ALL' ? null : next })
    }
  />
</div>

<div class="layout" class:wide class:showing={selectedId !== null}>
  <section class="queue" aria-label="Очередь">
    <Loadable resource={cases} loadingLabel="Загружаем заявки">
      {#snippet children(data)}
        {#if items.length === 0}
          <div class="m3-card">
            <EmptyState
              icon={status === 'OPEN' ? 'task_alt' : 'inbox'}
              title={status === 'OPEN' ? 'Очередь пуста' : 'Решённых заявок нет'}
              text={status === 'OPEN' ? 'Новые заявки появятся здесь.' : ''}
            />
          </div>
        {:else}
          <CaseList {items} {selectedId} onselect={select} />
          <Pagination
            {page}
            size={QUEUE_PAGE_SIZE}
            total={data.total}
            onchange={(next) => router.setQuery({ page: next > 0 ? next : null, case: null })}
          />
        {/if}
      {/snippet}
      {#snippet failed(error)}
        <LoadError {error} title="Не удалось загрузить заявки" onretry={() => cases.load()} />
      {/snippet}
    </Loadable>
  </section>

  {#if wide || selectedId}
    <section class="m3-card pane" aria-label="Заявка">
      {#if selectedId}
        {#key selectedId}
          <CaseDetail
            caseId={selectedId}
            onback={wide ? undefined : () => select(null)}
            ondecided={decided}
          />
        {/key}
      {:else}
        <EmptyState
          icon="gavel"
          title={cases.data && items.length === 0 ? 'Здесь пока пусто' : 'Выберите заявку'}
        />
      {/if}
    </section>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px 24px;
    margin: 16px 0;
  }
  .layout {
    display: grid;
    gap: 16px;
    align-items: start;
  }
  .layout.wide {
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
  }
  /* Phones: the open case takes the place of the list. */
  .layout:not(.wide).showing .queue {
    display: none;
  }
  .wide .queue {
    position: sticky;
    top: 16px;
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    border-radius: var(--md-shape-xl);
  }
  .pane {
    min-width: 0;
    padding: 20px 24px 28px;
  }
  @media (max-width: 600px) {
    .pane {
      padding: 16px;
    }
  }
</style>
