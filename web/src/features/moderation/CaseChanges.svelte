<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import DiffView, { type DiffRow } from './DiffView.svelte';
  import { CATEGORIES, visibilityLabel } from './labels';
  import TextDiff from './TextDiff.svelte';
  import type { CaseTarget, SubjectLinkTarget } from './types';

  // What the case would change against what others see now. For a link, `link` is the approved version
  // while an edit waits, or the revision itself before the first approval; for a review, `review.shown`
  // is the approved revision and is missing until one was approved.
  let { target }: { target: CaseTarget } = $props();

  const CAPTION = 'Изменения относительно одобренной версии';

  function linkRows({ revision, link }: SubjectLinkTarget): DiffRow[] {
    const audience = revision.flowId === link.flowId ? link.audienceLabel : null;
    return [
      {
        key: 'category',
        label: 'Категория',
        before: CATEGORIES[link.category].label,
        after: CATEGORIES[revision.category].label,
        changed: link.category !== revision.category,
      },
      {
        key: 'title',
        label: 'Название',
        before: link.title ?? '—',
        after: revision.title ?? '—',
        changed: (link.title ?? '') !== (revision.title ?? ''),
      },
      {
        key: 'url',
        label: 'Адрес',
        before: link.url,
        after: revision.url,
        changed: link.url !== revision.url,
      },
      {
        key: 'visibility',
        label: 'Кто видит',
        before: visibilityLabel(link.visibility, link.audienceLabel),
        after: visibilityLabel(revision.visibility, audience),
        changed: link.visibility !== revision.visibility || link.flowId !== revision.flowId,
      },
    ];
  }

  const view = $derived.by(() => {
    const afterLabel = target.revision.status === 'PENDING' ? 'На проверке' : 'В заявке';
    if (target.targetType === 'SUBJECT_RESOURCE') {
      const rows = linkRows(target);
      if (rows.some((row) => row.changed)) return { kind: 'diff' as const, rows, afterLabel };
      return target.link.status === 'PENDING'
        ? { kind: 'new' as const, text: 'Новая ссылка, одобренных версий ещё нет' }
        : null;
    }
    const shown = target.review.shown;
    if (!shown) return { kind: 'new' as const, text: 'Новый отзыв, одобренных версий ещё нет' };
    const subjectChanged = (shown.subjectTitle ?? '') !== (target.revision.subjectTitle ?? '');
    const textChanged = shown.text !== target.revision.text;
    if (!subjectChanged && !textChanged) return null;
    return {
      kind: 'review' as const,
      rows: [
        {
          key: 'subject',
          label: 'Предмет',
          before: shown.subjectTitle ?? '—',
          after: target.revision.subjectTitle ?? '—',
          changed: subjectChanged,
        },
      ],
      afterLabel,
      before: shown.text,
      after: target.revision.text,
      textChanged,
    };
  });
</script>

{#if view?.kind === 'new'}
  <p class="mod-note"><Icon name="release_alert" size={20} />{view.text}</p>
{:else if view}
  <section class="mod-section" aria-labelledby="case-changes">
    <h3 id="case-changes">Изменения</h3>
    <DiffView
      caption={CAPTION}
      rows={view.rows}
      beforeLabel="Одобрено"
      afterLabel={view.afterLabel}
    />
    {#if view.kind === 'review'}
      <h4 class="text-title">
        Текст
        {#if view.textChanged}
          <span class="m3-pill warn">изменено</span>
        {:else}
          <span class="m3-muted">не изменён</span>
        {/if}
      </h4>
      {#if view.textChanged}<TextDiff before={view.before} after={view.after} />{/if}
    {/if}
  </section>
{/if}

<style>
  .text-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 4px 0 0;
    font: var(--md-title-small);
  }
</style>
