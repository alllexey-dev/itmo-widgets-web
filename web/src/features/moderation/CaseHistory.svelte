<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { formatDateTime, formatRelative } from './format';
  import { ACTIONS, CAPABILITIES, REPORT_REASONS } from './labels';
  import type { ModerationDecision, ModerationReport } from './types';

  // Reports against the target (when it still exists) and every decision of the case, oldest first.
  let {
    reports,
    decisions,
  }: { reports: ModerationReport[] | null; decisions: ModerationDecision[] } = $props();

  function restrictionText(decision: ModerationDecision): string | null {
    const restriction = decision.restriction;
    if (!restriction) return null;
    const term = restriction.days ? `на ${restriction.days} дн.` : 'бессрочно';
    return `${CAPABILITIES[restriction.capability]}, ${term}`;
  }
</script>

{#if reports}
  <section class="mod-section" aria-labelledby="case-reports">
    <h3 id="case-reports">Жалобы <span class="mod-count">{reports.length}</span></h3>
    {#if reports.length === 0}
      <p class="m3-muted empty">Жалоб нет</p>
    {:else}
      <ul class="tiles">
        {#each reports as report, index (`${report.createdAt}-${index}`)}
          <li>
            <span class="headline">{REPORT_REASONS[report.reason]}</span>
            <span class="m3-muted support">
              {#if report.comment}«{report.comment}» ·{/if}
              <span title={formatDateTime(report.createdAt)}
                >{formatRelative(report.createdAt)}</span
              >
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<section class="mod-section" aria-labelledby="case-decisions">
  <h3 id="case-decisions">Решения</h3>
  {#if decisions.length === 0}
    <p class="m3-muted empty">Решений пока нет</p>
  {:else}
    <ol class="timeline">
      {#each decisions as decision (decision.id)}
        {@const action = ACTIONS[decision.action]}
        {@const restriction = restrictionText(decision)}
        <li>
          <span class="dot"><Icon name={action.icon} size={18} /></span>
          <div class="event">
            <span class="headline">{action.label}</span>
            <span class="m3-muted">
              {decision.actor === 'POLICY' ? 'Автоматически' : 'Модератор'} · {formatDateTime(
                decision.createdAt,
              )}
            </span>
            {#if restriction}<span>{restriction}</span>{/if}
            {#if decision.note}<p class="note">{decision.note}</p>{/if}
          </div>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .empty {
    margin: 0;
  }
  .tiles {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .tiles li {
    display: grid;
    gap: 2px;
    padding: 12px 16px;
    border-radius: var(--md-shape-xs);
    background: var(--md-surface-container-lowest);
  }
  .tiles li:first-child {
    border-top-left-radius: var(--md-shape-lg);
    border-top-right-radius: var(--md-shape-lg);
  }
  .tiles li:last-child {
    border-bottom-left-radius: var(--md-shape-lg);
    border-bottom-right-radius: var(--md-shape-lg);
  }
  .headline {
    font: var(--md-body-large);
  }
  .support {
    overflow-wrap: anywhere;
  }
  .timeline {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .timeline li {
    display: flex;
    gap: 12px;
  }
  .dot {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--md-secondary-container);
    color: var(--md-on-secondary-container);
  }
  .event {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
  .note {
    margin: 4px 0 0;
    padding: 8px 12px;
    border-radius: var(--md-shape-md);
    background: var(--md-surface-container-low);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
