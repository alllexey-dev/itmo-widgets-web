<script lang="ts">
  import { EmptyState, Icon, LoadingIndicator, LoadingOverlay, PageHeader } from '@alllexey/ui';
  import { api } from '../../api/client';
  import { formatDateTime } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import Pagination from '../../lib/Pagination.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href, router } from '../../lib/router.svelte';
  import { ACTIONS, detailsOf, targetOf, type AuditEntry } from './labels';

  // Who changed or started what, newest first; `page` lives in the URL.
  const SIZE = 20;

  interface AuditPage {
    items: AuditEntry[];
    page: number;
    size: number;
    total: number;
  }

  const page = $derived(Math.max(0, Number(router.query.get('page')) || 0));
  const request = (p: number) => ({
    key: `/api/admin/audit?page=${p}&size=${SIZE}`,
    fetch: () => api.get<AuditPage>('/api/admin/audit', { query: { page: p, size: SIZE } }),
  });
  const audit = new Resource<AuditPage>(request(0).key, request(0).fetch);
  $effect(() => {
    const next = request(page);
    void audit.load(next.key, next.fetch);
  });
</script>

<PageHeader
  title="Журнал"
  text="Кто и когда менял роли, правила модерации, версию приложения и учётные данные или запускал синхронизацию и ИИ-сводки"
/>

{#if audit.data}
  {@const list = audit.data}
  <LoadingOverlay loading={audit.loading}>
    <section class="m3-card flush">
      {#if list.items.length === 0}
        <EmptyState icon="history" title="Записей пока нет" />
      {:else}
        <div class="m3-table" role="table" aria-label="Журнал">
          <div class="tr th" role="row">
            <span role="columnheader">Когда</span>
            <span role="columnheader">Кто</span>
            <span role="columnheader">Действие</span>
            <span role="columnheader">Объект</span>
            <span role="columnheader">Подробности</span>
          </div>
          {#each list.items as entry (entry.id)}
            {@const action = ACTIONS[entry.action]}
            {@const target = targetOf(entry.target)}
            {@const details = detailsOf(entry)}
            <div class="tr" role="row">
              <span role="cell" class="m3-num nowrap">{formatDateTime(entry.createdAt)}</span>
              <span role="cell" class="actor">
                <a class="link" href={href(`/admin/users/${entry.actorIsu}`)}>{entry.actorName}</a>
                <span class="m3-muted m3-body-small">ИСУ {entry.actorIsu}</span>
              </span>
              <span role="cell" class="action">
                <Icon name={action?.icon ?? 'history'} size={20} />
                <span>{action?.label ?? entry.action}</span>
                {#if details.platform}<span class="m3-pill neutral">{details.platform}</span>{/if}
              </span>
              <span role="cell">
                {#if target.kind === 'user'}
                  <a class="link" href={href(`/admin/users/${target.isu}`)}>ИСУ {target.isu}</a>
                {:else}
                  {target.text}
                {/if}
              </span>
              <span role="cell">
                {#if details.text}
                  <code class="m3-mono details">{details.text}</code>
                {:else}
                  <span class="m3-muted">—</span>
                {/if}
              </span>
            </div>
          {/each}
        </div>
      {/if}
      <Pagination
        {page}
        size={SIZE}
        total={list.total}
        onchange={(next) => router.setQuery({ page: next > 0 ? next : null })}
      />
    </section>
  </LoadingOverlay>
{:else if audit.error}
  <section class="m3-card">
    <LoadError
      error={audit.error}
      title="Не удалось загрузить журнал"
      onretry={() => audit.load()}
    />
  </section>
{:else}
  <div class="waiting"><LoadingIndicator label="Загружаем журнал" /></div>
{/if}

<style>
  .tr {
    grid-template-columns: 148px minmax(150px, 1fr) minmax(190px, 1.2fr) minmax(140px, 1fr) minmax(
        200px,
        1.6fr
      );
    min-width: 900px;
    align-items: start;
  }
  .nowrap {
    white-space: nowrap;
  }
  .actor {
    display: grid;
  }
  .action {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .link {
    color: var(--md-primary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .details {
    overflow-wrap: anywhere;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 40vh;
  }
</style>
