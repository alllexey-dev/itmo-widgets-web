<script lang="ts">
  import { PageHeader, Resource, Tabs, type TabOption } from '@alllexey/ui';
  import { MediaQuery } from 'svelte/reactivity';
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

  type Tab = 'cases' | 'restrictions';
  const PATHS: Record<Tab, string> = {
    cases: '/admin/moderation',
    restrictions: '/admin/restrictions',
  };
  const tabs = $derived<TabOption<Tab>[]>([
    { value: 'cases', label: 'Заявки', badge: openCount.data || undefined },
    { value: 'restrictions', label: 'Ограничения' },
  ]);
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

<Tabs label="Модерация" options={tabs} value={tab} onchange={(next) => router.go(PATHS[next])} />

<div role="tabpanel" aria-label={tab === 'cases' ? 'Заявки' : 'Ограничения'}>
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
</style>
