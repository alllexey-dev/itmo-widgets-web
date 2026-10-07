<script lang="ts">
  // A minimal data card for tests of Resource and LoadError: the shape every section page follows.
  import { LoadingIndicator, LoadingOverlay } from '@alllexey/ui';
  import { api } from '../api/client';
  import LoadError from '../lib/LoadError.svelte';
  import { Resource } from '../lib/resource.svelte';

  const items = new Resource('/api/test/items', () => api.get<string[]>('/api/test/items'));
  void items.load();
</script>

{#if items.data}
  <LoadingOverlay loading={items.loading}>
    <ul aria-label="Список">
      {#each items.data as item (item)}<li>{item}</li>{/each}
    </ul>
  </LoadingOverlay>
{:else if items.error}
  <LoadError error={items.error} title="Не удалось загрузить список" onretry={() => items.load()} />
{:else}
  <LoadingIndicator label="Загружаем список" />
{/if}
