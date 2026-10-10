<script lang="ts">
  import { Icon, Loadable, Resource } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { href } from '../../lib/router.svelte';
  import { queueRows, sportEntries } from './student';

  // The sport queues the user stands in; leaving one and the history are on Спорт.
  const SHOWN = 3;
  const entries = new Resource(sportEntries.key, sportEntries.fetch);
  void entries.load();
  const rows = $derived(entries.data ? queueRows(entries.data) : []);
</script>

<section class="m3-card" aria-labelledby="home-queues">
  <div class="head">
    <h2 id="home-queues" class="m3-section-title">Очереди на спорт</h2>
    <a class="m3-btn text small" href={href('/sport')} aria-label="Все очереди">Все</a>
  </div>
  <Loadable resource={entries} loadingLabel="Загружаем очереди">
    {#if rows.length > 0}
      <ul class="m3-segmented" aria-label="Очереди на спорт">
        {#each rows.slice(0, SHOWN) as row (row.id)}
          <li class="m3-list-item queue">
            <span class="lead icon" aria-hidden="true"><Icon name={row.icon} /></span>
            <span class="main">
              <span class="headline">{row.section}</span>
              <span class="support">{row.when} · {row.kind}</span>
            </span>
            <span class="trail"><span class="m3-pill {row.tone}">{row.status}</span></span>
          </li>
        {/each}
      </ul>
      {#if rows.length > SHOWN}
        <p class="m3-body-small m3-muted note">
          И ещё {rows.length - SHOWN} на странице «Спорт».
        </p>
      {/if}
    {:else}
      <p class="m3-muted">Вы не стоите в очередях.</p>
    {/if}
    <p class="m3-body-small m3-muted note">
      Встать в очередь можно в приложении: расписание секций приходит из My ITMO.
    </p>
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить очереди" onretry={() => entries.load()} />
    {/snippet}
  </Loadable>
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .head h2 {
    margin: 0;
  }
  p {
    margin: 0;
  }
  .icon {
    display: grid;
    color: var(--md-on-surface-variant);
  }
  .note {
    margin: 12px 4px 0;
  }
  /* On a phone the status moves under the text instead of squeezing the section. */
  @media (max-width: 520px) {
    .queue {
      flex-wrap: wrap;
      row-gap: 4px;
    }
    .queue .main {
      flex: 1 1 calc(100% - 72px);
    }
    .queue .support {
      white-space: normal;
    }
    .queue .trail {
      flex: 1 0 100%;
      text-align: right;
    }
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 96px;
  }
</style>
