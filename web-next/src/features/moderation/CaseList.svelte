<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { formatDateTime, formatRelative } from './format';
  import { CATEGORIES, hostOf, REASONS } from './labels';
  import type { AdminCaseItem } from './types';

  let {
    items,
    selectedId,
    onselect,
  }: { items: AdminCaseItem[]; selectedId: string | null; onselect: (id: string) => void } =
    $props();

  interface RowTexts {
    icon: string;
    title: string;
    line: string;
    hidden: string | null;
  }

  function linkRow(item: AdminCaseItem): RowTexts {
    const { revision, link } = item;
    if (!revision) {
      return { icon: 'link_off', title: 'Ссылка удалена', line: 'Нет данных', hidden: null };
    }
    const host = hostOf(revision.url);
    return {
      icon: CATEGORIES[revision.category].icon,
      title: revision.title?.trim() || host || revision.url,
      line: [link?.subjectName, host].filter(Boolean).join(' · ') || 'Нет данных',
      hidden: link?.hidden ? 'скрыта' : null,
    };
  }

  function reviewRow(item: AdminCaseItem): RowTexts {
    const review = item.review;
    if (!review) {
      return { icon: 'comments_disabled', title: 'Отзыв удалён', line: 'Нет данных', hidden: null };
    }
    return {
      icon: 'rate_review',
      title: [`ИСУ ${review.teacherIsu}`, review.subjectTitle].filter(Boolean).join(' · '),
      line: review.excerpt,
      hidden: review.hidden ? 'скрыт' : null,
    };
  }

  const rowOf = (item: AdminCaseItem) =>
    item.targetType === 'TEACHER_REVIEW' ? reviewRow(item) : linkRow(item);

  let list = $state<HTMLUListElement>();
  // J and K move the selection; keep it on screen.
  $effect(() => {
    if (!selectedId) return;
    list
      ?.querySelector<HTMLElement>('[aria-current="true"]')
      ?.scrollIntoView?.({ block: 'nearest' });
  });
</script>

<ul bind:this={list} class="list" aria-label="Заявки">
  {#each items as item (item.id)}
    {@const row = rowOf(item)}
    {@const reason = REASONS[item.reason]}
    {@const time = item.status === 'OPEN' ? item.openedAt : (item.resolvedAt ?? item.openedAt)}
    {@const selected = item.id === selectedId}
    <li>
      <button
        class="row"
        class:selected
        aria-current={selected ? 'true' : undefined}
        onclick={() => onselect(item.id)}
      >
        <span class="icon"><Icon name={row.icon} /></span>
        <span class="body">
          <span class="title m3-clip">{row.title}</span>
          <span class="line m3-clip">{row.line}</span>
          <span class="meta">
            {#if item.author}<span class="m3-clip">{item.author.name}</span>{/if}
            <span title={formatDateTime(time)}>{formatRelative(time)}</span>
            {#if item.reportCount > 0}
              <span class="reports">
                <Icon name="flag" size={16} />{item.reportCount}<span class="mod-vh"
                  >&nbsp;жалоб</span
                >
              </span>
            {/if}
            {#if row.hidden}<span class="hidden">{row.hidden}</span>{/if}
          </span>
        </span>
        <span class="m3-pill {reason.tone} reason">{reason.label}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    border-radius: var(--md-shape-xs);
    overflow: hidden;
  }
  li:first-child {
    border-top-left-radius: var(--md-shape-xl);
    border-top-right-radius: var(--md-shape-xl);
  }
  li:last-child {
    border-bottom-left-radius: var(--md-shape-xl);
    border-bottom-right-radius: var(--md-shape-xl);
  }
  .row {
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    min-height: 72px;
    padding: 10px 16px;
    border: none;
    text-align: left;
    background: var(--md-surface-container);
    color: var(--md-on-surface);
    transition: background 0.2s var(--md-effects-default);
  }
  .row::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: var(--md-on-surface);
    opacity: 0;
    transition: opacity 0.15s;
  }
  @media (hover: hover) {
    .row:hover::before {
      opacity: 0.08;
    }
  }
  .row:active::before {
    opacity: 0.12;
  }
  .row:focus-visible {
    outline: 3px solid var(--md-secondary);
    outline-offset: -3px;
  }
  .row.selected {
    background: var(--md-secondary-container);
    color: var(--md-on-secondary-container);
  }
  .icon {
    flex: none;
    display: grid;
    color: var(--md-on-surface-variant);
  }
  .selected .icon {
    color: inherit;
  }
  .body {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .title {
    font: var(--md-body-large);
  }
  .line {
    font: var(--md-body-medium);
    color: var(--md-on-surface-variant);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 4px 10px;
    min-width: 0;
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  .meta > :global(*) {
    flex: none;
  }
  .meta > .m3-clip {
    flex: 0 1 auto;
  }
  .selected .line,
  .selected .meta {
    color: inherit;
    opacity: 0.85;
  }
  .reports {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .hidden {
    color: var(--md-error);
  }
  .reason {
    flex: none;
  }
</style>
