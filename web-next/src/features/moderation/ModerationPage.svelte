<script lang="ts">
  import { PageHeader } from '@alllexey/ui';
  import { MediaQuery } from 'svelte/reactivity';
  import { Resource } from '../../lib/resource.svelte';
  import { router } from '../../lib/router.svelte';
  import { fetchOpenCount, OPEN_COUNT_KEY } from './api';
  import CasesTab from './CasesTab.svelte';
  import './icons';
  import './moderation.css';
  import RestrictionsTab from './RestrictionsTab.svelte';

  // Модерация with two tabs: Заявки at /admin/moderation and Ограничения at /admin/restrictions, so both
  // bookmarks of the previous web keep working.
  const wide = new MediaQuery('min-width: 1100px');
  const tab = $derived(router.route.name === 'restrictions' ? 'restrictions' : 'cases');

  const openCount = new Resource(OPEN_COUNT_KEY, fetchOpenCount);
  void openCount.load();

  const TABS = [
    { id: 'cases', label: 'Заявки', path: '/admin/moderation' },
    { id: 'restrictions', label: 'Ограничения', path: '/admin/restrictions' },
  ] as const;
</script>

<PageHeader title="Модерация" text="Новые ссылки и отзывы, жалобы и низкий рейтинг">
  {#snippet actions()}
    {#if tab === 'cases' && wide.current}
      <p class="hint">
        <span><kbd class="mod-kbd">J</kbd> <kbd class="mod-kbd">K</kbd> следующая и предыдущая</span
        >
        <span><kbd class="mod-kbd">A</kbd> одобрить</span>
        <span><kbd class="mod-kbd">R</kbd> отклонить</span>
      </p>
    {/if}
  {/snippet}
</PageHeader>

<div class="m3-tabs" role="tablist" aria-label="Модерация">
  {#each TABS as item (item.id)}
    <button
      role="tab"
      id="tab-{item.id}"
      class:active={tab === item.id}
      aria-selected={tab === item.id}
      aria-controls="panel-{item.id}"
      onclick={() => tab !== item.id && router.go(item.path)}
    >
      {item.label}
      {#if item.id === 'cases' && openCount.data}
        <span class="count m3-num">{openCount.data}</span>
      {/if}
    </button>
  {/each}
</div>

<div role="tabpanel" id="panel-{tab}" aria-labelledby="tab-{tab}">
  {#if tab === 'cases'}
    <CasesTab wide={wide.current} ondecided={() => openCount.load()} />
  {:else}
    <RestrictionsTab />
  {/if}
</div>

<style>
  .hint {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 0;
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  .hint span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .count {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
</style>
