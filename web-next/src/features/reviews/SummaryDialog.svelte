<script lang="ts">
  import { Dialog, Icon, snackbars } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { errorText } from '../../api/errors';
  import { regenerateSummary, setSummaryHidden } from './api';
  import { formatDateTime, formatNumber, plural } from './format';
  import {
    SUMMARY_CONFIDENCES,
    SUMMARY_LEVELS,
    SUMMARY_SCALE_VALUES,
    SUMMARY_SCALES,
    SUMMARY_STATUSES,
    summaryTagLabel,
  } from './labels';
  import type { TeacherSummaryRow } from './types';

  // One teacher's summary. Texts come from the model and are rendered as text only: no HTML, no links.
  // Each change answers the updated row, which replaces the one the dialog started from.
  let {
    row: initial,
    enabled,
    onchanged,
    onclose,
  }: {
    row: TeacherSummaryRow;
    /** Summaries are on at the server. */
    enabled: boolean;
    onchanged: () => void;
    onclose: () => void;
  } = $props();

  /** The backend builds a summary from at least this many reviews. */
  const MIN_REVIEWS = 3;
  const ERRORS = {
    not_found: 'Сводка не найдена',
    business_rule_violation: 'Сейчас пересчитать нельзя',
  };

  let row = $state(untrack(() => initial));
  let busy = $state(false);
  const status = $derived(SUMMARY_STATUSES[row.status]);
  const canRegenerate = $derived(enabled && !row.hidden && row.inputCount >= MIN_REVIEWS);

  async function change(run: () => Promise<TeacherSummaryRow>, done: string, failed: string) {
    busy = true;
    try {
      row = await run();
      snackbars.show(done);
    } catch (error) {
      snackbars.error(errorText(error, failed, ERRORS));
    } finally {
      busy = false;
      onchanged();
    }
  }

  const toggleHidden = () =>
    row.hidden
      ? change(
          () => setSummaryHidden(row.teacherIsu, false),
          'Сводка показана',
          'Не удалось показать сводку',
        )
      : change(
          () => setSummaryHidden(row.teacherIsu, true),
          'Сводка скрыта',
          'Не удалось скрыть сводку',
        );

  const regenerate = () =>
    change(
      () => regenerateSummary(row.teacherIsu),
      'Пересчёт запрошен',
      'Не удалось пересчитать сводку',
    );
</script>

<Dialog
  title={row.teacherName ?? `ИСУ ${row.teacherIsu}`}
  text={row.teacherName ? `ИСУ ${row.teacherIsu}` : ''}
  wide
  {onclose}
>
  <div class="summary">
    <p class="line">
      <span class="m3-pill {status.pill}">{status.label}</span>
      <span class="m3-body-medium">Отзывов сейчас: {formatNumber(row.inputCount)}</span>
      {#if row.hiddenAt}
        <span class="m3-body-medium m3-muted">
          {row.hiddenByName ? `Скрыл ${row.hiddenByName}` : 'Скрыта'} · {formatDateTime(
            row.hiddenAt,
          )}
        </span>
      {/if}
    </p>
    {#if row.lastError}
      <p class="line">
        <code class="m3-mono m3-body-small error">{row.lastError}</code>
        <span class="m3-body-small m3-muted">
          Попыток: {formatNumber(row.attempts)}{row.lastAttemptAt
            ? ` · ${formatDateTime(row.lastAttemptAt)}`
            : ''}
        </span>
      </p>
    {/if}
    {#if row.summary}
      {@const summary = row.summary}
      <p class="m3-body-small m3-muted">
        Сводка по {formatNumber(summary.reviewCount)}
        {plural(summary.reviewCount, ['отзыву', 'отзывам', 'отзывам'])} · ИИ · {formatDateTime(
          summary.generatedAt,
        )}
      </p>
      <p class="m3-body-large">
        Тон: {SUMMARY_LEVELS[summary.level]}<span class="m3-muted">
          · уверенность {SUMMARY_CONFIDENCES[summary.confidence]}</span
        >
      </p>
      <p class="text">{summary.description}</p>
      {#each [{ title: 'Плюсы', items: summary.pros }, { title: 'Минусы', items: summary.cons }] as points (points.title)}
        {#if points.items.length > 0}
          <section aria-label={points.title}>
            <h3 class="m3-title-small">{points.title}</h3>
            <ul>
              {#each points.items as item, index (index)}<li class="text">{item}</li>{/each}
            </ul>
          </section>
        {/if}
      {/each}
      {#if summary.tags.length > 0}
        <ul class="tags" aria-label="Теги">
          {#each summary.tags as tag (tag)}<li class="m3-chip">{summaryTagLabel(tag)}</li>{/each}
        </ul>
      {/if}
      <dl class="scales" aria-label="Шкалы">
        {#each summary.scales as scale (scale.kind)}
          <div>
            <dt class="m3-label-large">{SUMMARY_SCALES[scale.kind]}</dt>
            <dd class="m3-body-medium">
              {SUMMARY_SCALE_VALUES[scale.kind][scale.value]}{#if scale.reason}<span
                  class="m3-muted text">{` · ${scale.reason}`}</span
                >{/if}
            </dd>
          </div>
        {/each}
      </dl>
    {:else}
      <p class="m3-muted">Сводки ещё нет</p>
    {/if}
  </div>
  {#snippet actions()}
    <button class="m3-btn text" onclick={onclose}>Закрыть</button>
    <button class="m3-btn tonal" onclick={toggleHidden} disabled={busy}>
      <Icon name={row.hidden ? 'visibility' : 'visibility_off'} />{row.hidden
        ? 'Показать'
        : 'Скрыть'}
    </button>
    <button class="m3-btn" onclick={regenerate} disabled={busy || !canRegenerate}>
      <Icon name="refresh" />Пересчитать
    </button>
  {/snippet}
</Dialog>

<style>
  .summary {
    display: grid;
    gap: 12px;
  }
  .summary p,
  h3,
  ul,
  dl {
    margin: 0;
  }
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }
  .error {
    overflow-wrap: anywhere;
    color: var(--md-error);
  }
  .text {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
  section ul {
    display: grid;
    gap: 4px;
    margin-top: 4px;
    padding-left: 20px;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    list-style: none;
  }
  .scales {
    display: grid;
    gap: 8px;
  }
  dd {
    margin: 0;
  }
</style>
