<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { formatDateTime, formatRelative } from './format';
  import { scoreText, VERIFICATION } from './labels';
  import type { TeacherReviewTarget } from './types';

  // Moderators see anonymity and the ISU check as facts; the author is shown below even when anonymous.
  let { target }: { target: TeacherReviewTarget } = $props();

  const revision = $derived(target.revision);
  const review = $derived(target.review);
  const verification = $derived(VERIFICATION[review.verification]);
</script>

<section class="preview" aria-label="Отзыв">
  <div class="badges">
    <span class="m3-pill neutral">
      <Icon name={review.anonymous ? 'visibility_off' : 'person'} size={16} />
      {review.anonymous ? 'Анонимно' : 'С именем'}
    </span>
    <span class="m3-pill {verification.tone}">
      {#if review.verification === 'VERIFIED'}<Icon name="verified" size={16} />{/if}
      {verification.label}
    </span>
    {#if review.hidden}
      <span class="m3-pill warn"><Icon name="visibility_off" size={16} />Скрыт</span>
    {/if}
  </div>
  <dl class="mod-facts">
    <div>
      <dt>Предмет</dt>
      <dd>{revision.subjectTitle ?? 'Не указан'}</dd>
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
      <dd class="m3-num">{scoreText(review.score)}</dd>
    </div>
  </dl>
  <p class="text">{revision.text}</p>
</section>

<style>
  .preview {
    display: grid;
    gap: 16px;
    padding: 16px 20px;
    border-radius: var(--md-shape-lg);
    background: var(--md-surface-container-low);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .text {
    margin: 0;
    font: var(--md-body-large);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
