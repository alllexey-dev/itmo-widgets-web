<script lang="ts">
  import { LoadingIndicator } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { fetchVerification, VERIFICATION_PATH } from './api';
  import { formatNumber } from './format';
  import type { ReviewVerificationCounts } from './types';

  // Whether the teacher taught the author of the review, checked against ISU.
  const verification = new Resource<ReviewVerificationCounts>(VERIFICATION_PATH, fetchVerification);
  void verification.load();
</script>

<section class="m3-card" aria-labelledby="reviews-verification">
  <h2 class="m3-section-title" id="reviews-verification">Проверка по ИСУ</h2>
  <p class="m3-body-medium m3-muted lead">Вёл ли преподаватель у автора отзыва</p>
  {#if verification.data}
    <dl class="stats">
      <div>
        <dt>на проверке</dt>
        <dd class="m3-num">{formatNumber(verification.data.pending)}</dd>
      </div>
      <div>
        <dt>подтверждено</dt>
        <dd class="m3-num">{formatNumber(verification.data.verified)}</dd>
      </div>
      <div>
        <dt>не подтверждено</dt>
        <dd class="m3-num">{formatNumber(verification.data.unverified)}</dd>
      </div>
    </dl>
  {:else if verification.error}
    <LoadError
      error={verification.error}
      title="Не удалось загрузить проверку"
      onretry={() => verification.load()}
    />
  {:else}
    <LoadingIndicator label="Загружаем проверку" />
  {/if}
</section>

<style>
  .lead {
    margin: -4px 0 16px;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 16px;
    margin: 0;
  }
  .stats div {
    display: flex;
    flex-direction: column-reverse;
    justify-content: flex-end;
    gap: 2px;
  }
  dd {
    margin: 0;
    font: var(--md-headline-small);
  }
  dt {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
</style>
