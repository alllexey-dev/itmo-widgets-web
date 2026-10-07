<script lang="ts">
  import { wordDiff } from './wordDiff';

  // One text with deleted words struck through and added ones highlighted; screen readers hear which is which.
  let { before, after }: { before: string; after: string } = $props();
  const parts = $derived(wordDiff(before, after));
</script>

<p class="text">
  {#each parts as part, index (index)}{#if part.kind === 'removed'}<del
        ><span class="mod-vh">удалено:&nbsp;</span>{part.text}</del
      >{:else if part.kind === 'added'}<ins
        ><span class="mod-vh">добавлено:&nbsp;</span>{part.text}</ins
      >{:else}<span>{part.text}</span>{/if}{/each}
</p>

<style>
  .text {
    margin: 0;
    padding: 12px 16px;
    border-radius: var(--md-shape-lg);
    background: var(--md-surface-container-low);
    font: var(--md-body-large);
    overflow-wrap: anywhere;
  }
  /* The parts keep the author's spaces and line breaks; whitespace between the tags does not count. */
  .text > * {
    white-space: pre-wrap;
  }
  del {
    background: color-mix(in srgb, var(--md-error-container) 60%, transparent);
    color: var(--md-on-surface);
    text-decoration-color: var(--md-on-error-container);
    border-radius: 4px;
  }
  ins {
    background: color-mix(in srgb, var(--md-success-container) 70%, transparent);
    color: var(--md-on-surface);
    text-decoration: none;
    border-radius: 4px;
  }
</style>
