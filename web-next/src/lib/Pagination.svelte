<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { formatNumber } from './format';

  // "21-40 из 134" with previous and next; nothing when everything fits on the first page.
  // `page` is zero-based, as Backend pages are.
  let {
    page,
    size,
    total,
    onchange,
  }: { page: number; size: number; total: number; onchange: (page: number) => void } = $props();

  const pages = $derived(Math.max(1, Math.ceil(total / size)));
  const from = $derived(Math.min(total, page * size + 1));
  const to = $derived(Math.min(total, (page + 1) * size));
</script>

{#if total > size || page > 0}
  <nav class="pagination" aria-label="Страницы">
    <span class="range m3-num" aria-live="polite">
      {formatNumber(from)}–{formatNumber(to)} из {formatNumber(total)}
    </span>
    <button
      class="m3-icon-btn"
      aria-label="Предыдущая страница"
      disabled={page <= 0}
      onclick={() => onchange(page - 1)}
    >
      <Icon name="chevron_left" />
    </button>
    <button
      class="m3-icon-btn"
      aria-label="Следующая страница"
      disabled={page >= pages - 1}
      onclick={() => onchange(page + 1)}
    >
      <Icon name="chevron_right" />
    </button>
  </nav>
{/if}

<style>
  .pagination {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    padding: 8px 8px 8px 16px;
  }
  .range {
    margin-right: 8px;
    color: var(--md-on-surface-variant);
  }
</style>
