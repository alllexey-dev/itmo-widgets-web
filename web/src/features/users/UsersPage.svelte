<script lang="ts">
  import { EmptyState, Icon, LoadingIndicator, LoadingOverlay, PageHeader } from '@alllexey/ui';
  import { onDestroy } from 'svelte';
  import { api } from '../../api/client';
  import { counted, formatDate } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import Pagination from '../../lib/Pagination.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href, router } from '../../lib/router.svelte';
  import RoleBadges from './RoleBadges.svelte';
  import type { UserPage } from './types';

  // Search by ISU prefix, name or group; `q` and `page` live in the URL.
  const SIZE = 20;
  const QUERY_LIMIT = 100;
  const DEBOUNCE_MS = 300;

  const query = $derived(router.query.get('q')?.trim() ?? '');
  const page = $derived(Math.max(0, Number(router.query.get('page')) || 0));
  let text = $state(router.query.get('q') ?? '');

  const request = (q: string, p: number) => ({
    key: `/api/admin/users?query=${encodeURIComponent(q)}&page=${p}&size=${SIZE}`,
    fetch: () =>
      api.get<UserPage>('/api/admin/users', { query: { query: q, page: p, size: SIZE } }),
  });
  const users = new Resource<UserPage>(request('', 0).key, request('', 0).fetch);
  $effect(() => {
    const next = request(query, page);
    void users.load(next.key, next.fetch);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  function search(value: string) {
    text = value;
    clearTimeout(timer);
    timer = setTimeout(() => router.setQuery({ q: value.trim(), page: null }), DEBOUNCE_MS);
  }
  function clear() {
    clearTimeout(timer);
    text = '';
    router.setQuery({ q: null, page: null });
  }
  onDestroy(() => clearTimeout(timer));
</script>

<PageHeader title="Пользователи" text="Поиск по ИСУ, имени или группе" />

<div class="toolbar">
  <label class="m3-search search">
    <Icon name="search" />
    <input
      type="search"
      aria-label="Поиск"
      placeholder="ИСУ, имя или группа"
      autocomplete="off"
      maxlength={QUERY_LIMIT}
      value={text}
      oninput={(event) => search(event.currentTarget.value)}
    />
    {#if text}
      <button class="m3-icon-btn small" aria-label="Очистить" onclick={clear}>
        <Icon name="close" size={20} />
      </button>
    {/if}
  </label>
  {#if users.data}
    <span class="total m3-muted" aria-live="polite">
      {counted(users.data.total, ['пользователь', 'пользователя', 'пользователей'])}
    </span>
  {/if}
</div>

{#if users.data}
  {@const list = users.data}
  <LoadingOverlay loading={users.loading}>
    <section class="m3-card flush">
      {#if list.items.length === 0}
        <EmptyState
          icon="person_search"
          title="Никого не нашли"
          text={query ? 'Проверьте запрос: ИСУ, часть имени или группы' : ''}
        />
      {:else}
        <div class="m3-table" role="table" aria-label="Пользователи">
          <div class="tr th" role="row">
            <span role="columnheader">Пользователь</span>
            <span role="columnheader" class="end">ИСУ</span>
            <span role="columnheader">Группа</span>
            <span role="columnheader">Роли</span>
            <span role="columnheader" class="end">Регистрация</span>
          </div>
          {#each list.items as user (user.isu)}
            <div class="tr row" role="row">
              <span role="cell" class="m3-clip">
                <a class="name" href={href(`/admin/users/${user.isu}`)}>{user.name}</a>
              </span>
              <span role="cell" class="end m3-num">{user.isu}</span>
              <span role="cell">{user.groups[0]?.name ?? '—'}</span>
              <span role="cell" class="roles" class:none={user.roles.length === 0}>
                {#if user.roles.length > 0}<RoleBadges roles={user.roles} />{:else}—{/if}
              </span>
              <span role="cell" class="end m3-num">{formatDate(user.createdAt)}</span>
            </div>
          {/each}
        </div>
      {/if}
      <Pagination
        {page}
        size={SIZE}
        total={list.total}
        onchange={(next) => router.setQuery({ page: next > 0 ? next : null })}
      />
    </section>
  </LoadingOverlay>
{:else if users.error}
  <section class="m3-card">
    <LoadError
      error={users.error}
      title="Не удалось загрузить пользователей"
      onretry={() => users.load()}
    />
  </section>
{:else}
  <div class="waiting"><LoadingIndicator label="Загружаем пользователей" /></div>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .search {
    flex: 1 1 320px;
    max-width: 560px;
  }
  .search input::-webkit-search-cancel-button {
    display: none;
  }
  .tr {
    grid-template-columns: minmax(180px, 2fr) 88px minmax(80px, 1fr) minmax(150px, 1.4fr) 112px;
    min-width: 720px;
  }
  .row {
    position: relative;
    isolation: isolate;
  }
  /* The name link covers its row: the whole row opens the user, and it stays one link for a reader. */
  .name::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
  }
  .name {
    font: var(--md-title-small);
  }
  .row:has(.name:focus-visible) {
    outline: 3px solid var(--md-secondary);
    outline-offset: -3px;
  }
  .name:focus-visible {
    outline: none;
  }
  @media (hover: hover) {
    .row:hover {
      background: color-mix(in srgb, var(--md-on-surface) 6%, transparent);
    }
  }
  /* Phones: each user becomes a two-line item instead of a table scrolled sideways. */
  @media (max-width: 600px) {
    .th {
      position: absolute;
      min-width: 0;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px 12px;
      min-width: 0;
    }
    .row > :first-child {
      flex: 1 0 100%;
    }
    .row > :not(:first-child) {
      color: var(--md-on-surface-variant);
    }
    .row .end {
      text-align: left;
    }
    .th + .row {
      border-top: none;
    }
    .roles.none {
      display: none;
    }
  }
  .roles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .end {
    text-align: right;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 40vh;
  }
</style>
