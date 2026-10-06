<script lang="ts">
  import { EmptyState, Icon, LoadingIndicator, LoadingOverlay, Shape } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href } from '../../lib/router.svelte';
  import { hasAccess, session } from '../../lib/session.svelte';
  import { aiSummaries, credentials, openCases, reviewsSync, sport, type Source } from './api';
  import {
    aiRows,
    caseRows,
    credentialRows,
    reviewsRows,
    sportRows,
    type AttentionRow,
  } from './attention';

  // "Требует внимания" for staff, built only from existing admin endpoints. A moderator checks the
  // queue; the admin also checks credentials, sport automation, AI summaries and the reviews sync.

  interface Check {
    /** What could not be checked, in "Не удалось проверить: ...". */
    name: string;
    resource: Resource<unknown>;
    rows: () => AttentionRow[];
  }

  function check<T>(name: string, source: Source<T>, build: (data: T) => AttentionRow[]): Check {
    const resource = new Resource<T>(source.key, source.fetch);
    return {
      name,
      resource: resource as Resource<unknown>,
      rows: () => (resource.data === undefined ? [] : build(resource.data)),
    };
  }

  const checks: Check[] = [
    check('заявки', openCases, (page) => caseRows(page.total)),
    ...(hasAccess(session.user, 'admin')
      ? [
          check('учётные данные', credentials, (list) => credentialRows(list)),
          check('автозапись', sport, (status) => sportRows(status)),
          check('ИИ-сводки', aiSummaries, (ai) => aiRows(ai)),
          check('синхронизацию отзывов', reviewsSync, (sync) => reviewsRows(sync)),
        ]
      : []),
  ];
  checks.forEach((item) => void item.resource.load());

  const rows = $derived(checks.flatMap((item) => item.rows()));
  const failed = $derived(
    checks.filter((item) => item.resource.error && item.resource.data === undefined),
  );
  const retrying = $derived(checks.some((item) => item.resource.loading));
  const settled = $derived(
    checks.every((item) => item.resource.data !== undefined || item.resource.error),
  );
  // Rows appear together once every source answered, so the card does not grow row by row.
  let ready = $state(false);
  $effect(() => {
    if (settled) ready = true;
  });

  function retry() {
    failed.forEach((item) => void item.resource.load());
  }
</script>

<section class="m3-card attention" aria-labelledby="attention-title">
  <h2 id="attention-title" class="m3-section-title">Требует внимания</h2>
  {#if !ready}
    <div class="waiting"><LoadingIndicator label="Проверяем, что требует внимания" /></div>
  {:else if failed.length === checks.length}
    <LoadError error={failed[0]?.resource.error} title="Не удалось проверить" onretry={retry} />
  {:else}
    <LoadingOverlay loading={retrying}>
      {#if rows.length > 0}
        <ul class="m3-segmented rows">
          {#each rows as row (row.key)}
            <li>
              <a class="m3-list-item" href={href(row.to)}>
                <span class="lead">
                  <Shape
                    shape={row.tone === 'bad' ? 'softBurst' : 'cookie9'}
                    size={40}
                    color={row.tone === 'bad'
                      ? 'var(--md-error-container)'
                      : 'var(--md-warning-container)'}
                    fg={row.tone === 'bad'
                      ? 'var(--md-on-error-container)'
                      : 'var(--md-on-warning-container)'}
                  >
                    <Icon name={row.icon} size={20} />
                  </Shape>
                </span>
                <span class="main">
                  <span class="headline">{row.title}</span>
                  {#if row.text}<span class="support">{row.text}</span>{/if}
                </span>
                <span class="trail"><Icon name="chevron_right" /></span>
              </a>
            </li>
          {/each}
        </ul>
      {:else if failed.length === 0}
        <EmptyState
          icon="task_alt"
          title="Всё в порядке"
          text="Сейчас ничего не требует внимания"
        />
      {/if}
      {#if failed.length > 0}
        <div class="failed" role="alert">
          <Icon name="error" size={20} />
          <span class="m3-body-medium">
            Не удалось проверить {failed.map((item) => item.name).join(', ')}
          </span>
          <button class="m3-btn text" onclick={retry}>Повторить</button>
        </div>
      {/if}
    </LoadingOverlay>
  {/if}
</section>

<style>
  .attention {
    grid-column: 1 / -1;
  }
  .rows {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rows .headline,
  .rows .support {
    white-space: normal;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 120px;
  }
  .failed {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 12px;
    color: var(--md-error);
  }
  .failed span {
    flex: 1;
    min-width: 0;
  }
</style>
