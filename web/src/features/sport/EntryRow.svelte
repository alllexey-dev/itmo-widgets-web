<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { formatLessonTime, lessonOf, QUEUE_ICON, QUEUE_KIND, stateOf } from './labels';
  import type { QueueEntry } from './types';

  // One queue entry: section, when, which queue and its status; "Выйти" when it can still be left.
  let {
    entry,
    onleave,
    busy = false,
  }: { entry: QueueEntry; onleave?: (entry: QueueEntry) => void; busy?: boolean } = $props();
  const lesson = $derived(lessonOf(entry));
  const state = $derived(stateOf(entry));
</script>

<li class="m3-list-item entry">
  <span class="lead icon" aria-hidden="true"><Icon name={QUEUE_ICON[entry.type]} /></span>
  <span class="main">
    <span class="headline">{lesson.section}</span>
    <span class="support">{formatLessonTime(lesson)} · {QUEUE_KIND[entry.type]}</span>
  </span>
  <span class="trail actions">
    <span class="m3-pill {state.tone}">{state.label}</span>
    {#if onleave}
      <button
        class="m3-icon-btn"
        aria-label="Выйти из очереди: {lesson.section}"
        title="Выйти из очереди"
        disabled={busy}
        onclick={() => onleave(entry)}
      >
        <Icon name="close" />
      </button>
    {/if}
  </span>
</li>

<style>
  .icon {
    display: grid;
    color: var(--md-on-surface-variant);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  /* On a phone the status and the button move under the text instead of squeezing the section. */
  @media (max-width: 520px) {
    .entry {
      flex-wrap: wrap;
      row-gap: 4px;
    }
    .entry .main {
      flex: 1 1 calc(100% - 72px);
    }
    .entry .support {
      white-space: normal;
    }
    .actions {
      flex: 1 0 100%;
      justify-content: flex-end;
    }
  }
</style>
