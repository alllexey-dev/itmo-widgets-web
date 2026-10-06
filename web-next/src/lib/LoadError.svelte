<script lang="ts">
  import { EmptyState } from '@alllexey/ui';
  import { ApiError } from '../api/client';
  import { errorText } from '../api/errors';

  // The error state of a data card. A 403 here is the page's access error: the session stays.
  let { error, title, onretry }: { error: unknown; title: string; onretry: () => void } = $props();
  const forbidden = $derived(error instanceof ApiError && error.isForbidden);
</script>

{#if forbidden}
  <EmptyState icon="lock" title="Нет доступа" text="Недостаточно прав, чтобы открыть эти данные." />
{:else}
  <EmptyState error {title} text={errorText(error, 'Попробуйте ещё раз')}>
    <button class="m3-btn tonal" onclick={onretry}>Повторить</button>
  </EmptyState>
{/if}
