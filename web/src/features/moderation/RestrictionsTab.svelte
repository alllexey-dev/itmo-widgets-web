<script lang="ts">
  import {
    Avatar,
    type ChipOption,
    Chips,
    ConfirmDialog,
    EmptyState,
    Icon,
    Loadable,
    Resource,
    Search,
    snackbars,
  } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { href, router } from '../../lib/router.svelte';
  import {
    fetchRestrictions,
    restrictionsKey,
    revokeRestriction,
    RESTRICTIONS_PAGE_SIZE,
    type RestrictionFilter,
  } from './api';
  import { formatDate } from './format';
  import { CAPABILITIES, type PillTone } from './labels';
  import Pagination from './Pagination.svelte';
  import type { AdminPage, AdminRestriction } from './types';

  // Who may not do what after moderation decisions. `isu`, `all` and `page` live in the query string;
  // the ISU search waits for a pause in typing before it asks the Backend.
  const ISU_PATTERN = /^\d{1,9}$/;

  const initialIsu = router.query.get('isu') ?? '';
  let isuText = $state(initialIsu);
  let debounced = $state(initialIsu.trim());
  $effect(() => {
    const value = isuText.trim();
    const timer = setTimeout(() => (debounced = value), 300);
    return () => clearTimeout(timer);
  });
  const STATES: ChipOption<'active' | 'all'>[] = [
    { value: 'active', label: 'Действующие' },
    { value: 'all', label: 'Все' },
  ];
  const valid = $derived(debounced === '' || ISU_PATTERN.test(debounced));
  const active = $derived(router.query.get('all') !== '1');
  const page = $derived(Math.max(0, Number(router.query.get('page')) || 0));

  const filter = (): RestrictionFilter => ({
    isu: valid && debounced ? Number(debounced) : null,
    active,
    page,
  });
  const restrictions = new Resource<AdminPage<AdminRestriction>>(restrictionsKey(filter()), () =>
    fetchRestrictions(filter()),
  );
  const key = $derived(restrictionsKey(filter()));
  $effect(() => {
    void restrictions.load(key, () => fetchRestrictions(filter()));
  });

  function changeIsu(value: string) {
    isuText = value;
    router.setQuery({ isu: value.trim() || null, page: null });
  }

  function stateOf(restriction: AdminRestriction): { label: string; tone: PillTone } {
    if (restriction.active) return { label: 'Действует', tone: 'warn' };
    if (restriction.revokedAt) return { label: 'Снято', tone: 'neutral' };
    return { label: 'Истекло', tone: 'neutral' };
  }

  function term(restriction: AdminRestriction): string {
    const from = formatDate(restriction.startsAt);
    const end = restriction.revokedAt ?? restriction.expiresAt;
    return end ? `${from} — ${formatDate(end)}` : `с ${from}, бессрочно`;
  }

  let confirming = $state<AdminRestriction | null>(null);
  let revoking = $state(false);

  async function revoke() {
    if (!confirming || revoking) return;
    revoking = true;
    try {
      await revokeRestriction(confirming.id);
      snackbars.show('Ограничение снято');
      confirming = null;
      void restrictions.load();
    } catch (error) {
      snackbars.error(errorText(error, 'Не удалось снять ограничение'));
    } finally {
      revoking = false;
    }
  }
</script>

<div class="toolbar">
  <div class="search-field">
    <Search
      value={isuText}
      label="ИСУ"
      placeholder="Поиск по ИСУ"
      inputmode="numeric"
      autocomplete="off"
      aria-invalid={!valid}
      aria-describedby={valid ? undefined : 'isu-error'}
      oninput={changeIsu}
    />
    {#if !valid}<small id="isu-error" class="error">Только цифры</small>{/if}
  </div>
  <div class="chips">
    <Chips
      label="Состояние"
      options={STATES}
      bind:value={
        () => (active ? 'active' : 'all'),
        (next) => next && router.setQuery({ all: next === 'all' ? '1' : null, page: null })
      }
    />
  </div>
</div>

<Loadable resource={restrictions} loadingLabel="Загружаем ограничения">
  {#snippet children(data)}
    <section class="m3-card flush">
      {#if data.items.length === 0}
        {#if debounced}
          <EmptyState icon="search_off" title="Ничего не нашли" text="Проверьте номер ИСУ." />
        {:else}
          <EmptyState
            icon="verified_user"
            title={active ? 'Действующих ограничений нет' : 'Ограничений ещё не было'}
          />
        {/if}
      {:else}
        <div class="scroll">
          <table>
            <caption class="mod-vh">Ограничения</caption>
            <thead>
              <tr>
                <th scope="col">Пользователь</th>
                <th scope="col">Что запрещено</th>
                <th scope="col">Причина</th>
                <th scope="col">Срок</th>
                <th scope="col">Состояние</th>
                <th scope="col"><span class="mod-vh">Действия</span></th>
              </tr>
            </thead>
            <tbody>
              {#each data.items as row (row.id)}
                {@const rowState = stateOf(row)}
                {@const capability = CAPABILITIES[row.capability]}
                <tr>
                  <td>
                    <span class="user">
                      <Avatar
                        name={row.user.name}
                        src={row.user.pictureUrl ?? ''}
                        size={32}
                        decorative
                      />
                      <span class="user-text">
                        <span class="name">{row.user.name}</span>
                        <span class="m3-muted">ИСУ {row.user.isu}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Что запрещено">{capability}</td>
                  <td class="reason" data-label="Причина">{row.reason}</td>
                  <td data-label="Срок">{term(row)}</td>
                  <td data-label="Состояние">
                    <span class="m3-pill {rowState.tone}">{rowState.label}</span>
                  </td>
                  <td class="actions">
                    <a
                      class="m3-icon-btn"
                      href={href(`/admin/moderation?case=${encodeURIComponent(row.caseId)}`)}
                      aria-label="Заявка: {row.user.name}, {capability}"
                      title="Заявка"
                    >
                      <Icon name="gavel" size={20} />
                    </a>
                    {#if row.active}
                      <button
                        class="m3-btn text small"
                        aria-label="Снять ограничение: {row.user.name}, {capability}"
                        onclick={() => (confirming = row)}
                      >
                        Снять
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
      <Pagination
        {page}
        size={RESTRICTIONS_PAGE_SIZE}
        total={data.total}
        onchange={(next) => router.setQuery({ page: next > 0 ? next : null })}
      />
    </section>
  {/snippet}
  {#snippet failed(error)}
    <LoadError
      {error}
      title="Не удалось загрузить ограничения"
      onretry={() => restrictions.load()}
    />
  {/snippet}
</Loadable>

{#if confirming}
  <ConfirmDialog
    title="Снять ограничение?"
    text="{confirming.user.name} снова сможет: {CAPABILITIES[confirming.capability].toLowerCase()}."
    confirmLabel="Снять"
    onconfirm={revoke}
    oncancel={() => !revoking && (confirming = null)}
  />
{/if}

<style>
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 12px 24px;
    margin: 16px 0;
  }
  .search-field {
    display: grid;
    gap: 4px;
    flex: 0 1 320px;
    min-width: 0;
  }
  .error {
    padding: 0 16px;
    font: var(--md-body-small);
    color: var(--md-error);
  }
  .chips {
    padding-top: 8px;
  }
  /* Also the containing block of the hidden caption, which would otherwise widen the page. */
  .scroll {
    position: relative;
    overflow-x: auto;
  }
  table {
    width: 100%;
    min-width: 760px;
    border-collapse: collapse;
    font: var(--md-body-medium);
  }
  th,
  td {
    padding: 12px 16px;
    text-align: start;
    vertical-align: middle;
  }
  th {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  tbody tr {
    border-top: 1px solid var(--md-outline-variant);
  }
  .user {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .user-text {
    display: grid;
  }
  .name {
    font: var(--md-title-small);
  }
  .reason {
    max-width: 260px;
    overflow-wrap: anywhere;
  }
  .actions {
    white-space: nowrap;
    text-align: end;
  }
  .actions > * {
    vertical-align: middle;
  }
  /* Phones: one card per restriction, labelled lines instead of columns. */
  @media (max-width: 760px) {
    table {
      min-width: 0;
    }
    thead {
      display: none;
    }
    tr,
    td {
      display: block;
    }
    tbody tr {
      position: relative;
      padding: 12px 16px;
    }
    td {
      padding: 2px 0;
    }
    td[data-label]::before {
      content: attr(data-label) ': ';
      color: var(--md-on-surface-variant);
    }
    td:first-child {
      padding: 0 112px 8px 0;
    }
    .reason {
      max-width: none;
    }
    .actions {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 0;
    }
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 240px;
  }
</style>
