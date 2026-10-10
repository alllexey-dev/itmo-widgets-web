<script lang="ts">
  // A minimal data card for tests of LoadError under the package's Loadable: the shape every section page follows.
  import { Loadable, Resource } from '@alllexey/ui';
  import { api } from '../api/client';
  import LoadError from '../lib/LoadError.svelte';

  const items = new Resource('/api/test/items', () => api.get<string[]>('/api/test/items'));
  void items.load();
</script>

<Loadable resource={items} loadingLabel="Загружаем список">
  {#snippet children(list)}
    <ul aria-label="Список">
      {#each list as item (item)}<li>{item}</li>{/each}
    </ul>
  {/snippet}
  {#snippet failed(error)}
    <LoadError {error} title="Не удалось загрузить список" onretry={() => items.load()} />
  {/snippet}
</Loadable>
