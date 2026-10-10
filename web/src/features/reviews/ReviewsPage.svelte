<script lang="ts">
  import { PageHeader, Resource } from '@alllexey/ui';
  import { fetchSummaries, POLL_MILLIS, SUMMARIES_PATH } from './api';
  import './icons';
  import SummariesCard from './SummariesCard.svelte';
  import SummariesTable from './SummariesTable.svelte';
  import SyncCard from './SyncCard.svelte';
  import type { AiSummariesState } from './types';
  import VerificationCard from './VerificationCard.svelte';

  // The AI state is shared by its card, the teachers table (reload after a run) and the dialog.
  const summaries = new Resource<AiSummariesState>(SUMMARIES_PATH, fetchSummaries);
  void summaries.load();

  // Quietly re-read the state while a run goes.
  const polling = $derived(summaries.data?.running ?? false);
  $effect(() => {
    if (polling) return summaries.poll(POLL_MILLIS);
  });
</script>

<PageHeader title="Отзывы" text="Отзывы из проекта Reviews, проверка по ИСУ и ИИ-сводки" />

<div class="cards">
  <SyncCard />
  <VerificationCard />
  <div class="wide"><SummariesCard {summaries} /></div>
  <div class="wide">
    <SummariesTable
      enabled={summaries.data?.enabled ?? false}
      running={summaries.data?.running ?? false}
      onchanged={() => summaries.load()}
    />
  </div>
</div>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
    gap: 16px;
    align-items: start;
  }
  .cards > :global(*) {
    min-width: 0;
  }
  .wide {
    grid-column: 1 / -1;
  }
</style>
