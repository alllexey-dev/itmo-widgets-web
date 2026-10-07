<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { formatDateTime, formatRelative } from './format';
  import { CATEGORIES, hostOf, scoreText, visibilityLabel } from './labels';
  import type { SubjectLinkTarget } from './types';

  let { target }: { target: SubjectLinkTarget } = $props();

  const revision = $derived(target.revision);
  const link = $derived(target.link);
  const category = $derived(CATEGORIES[revision.category]);
  const host = $derived(hostOf(revision.url));
  // The flow name is known only for the link's current flow.
  const audience = $derived(revision.flowId === link.flowId ? link.audienceLabel : null);
  const urlParts = $derived.by(() => {
    if (!host) return null;
    const [before = '', ...rest] = revision.url.split(host);
    return { before, after: rest.join(host) };
  });
</script>

<section class="preview" aria-label="Ссылка">
  <div class="head">
    <div class="text">
      <span class="category"><Icon name={category.icon} size={18} />{category.label}</span>
      <span class="title">{revision.title?.trim() || 'Без названия'}</span>
      <span class="url m3-clip" title={revision.url}>
        {#if urlParts}
          <span class="muted">{urlParts.before}</span><span class="host">{host}</span><span
            class="muted">{urlParts.after}</span
          >
        {:else}
          {revision.url}
        {/if}
      </span>
    </div>
    <a class="m3-btn tonal small" href={revision.url} target="_blank" rel="noopener noreferrer">
      <Icon name="open_in_new" size={18} />Открыть
    </a>
  </div>
  <dl class="mod-facts">
    <div>
      <dt>Кто видит</dt>
      <dd>{visibilityLabel(revision.visibility, audience)}</dd>
    </div>
    <div>
      <dt>Версия</dt>
      <dd>
        № {revision.number} ·
        <span title={formatDateTime(revision.submittedAt)}
          >{formatRelative(revision.submittedAt)}</span
        >
      </dd>
    </div>
    <div>
      <dt>Рейтинг</dt>
      <dd class="m3-num">{scoreText(link.score)}</dd>
    </div>
    {#if link.status === 'HIDDEN'}
      <div>
        <dt>Состояние</dt>
        <dd><span class="m3-pill warn"><Icon name="visibility_off" size={16} />Скрыта</span></dd>
      </div>
    {/if}
  </dl>
</section>

<style>
  .preview {
    display: grid;
    gap: 16px;
    padding: 16px 20px;
    border-radius: var(--md-shape-lg);
    background: var(--md-surface-container-low);
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .category {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .title {
    font: var(--md-title-medium);
    overflow-wrap: anywhere;
  }
  .url {
    font: var(--md-body-small);
  }
  .muted {
    color: var(--md-on-surface-variant);
  }
  .host {
    color: var(--md-on-surface);
    font-weight: 500;
  }
  .head > a {
    flex: none;
  }
</style>
