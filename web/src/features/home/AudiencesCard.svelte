<script lang="ts">
  import { Loadable, Resource } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { href } from '../../lib/router.svelte';
  import { AUDIENCE, privacy } from './student';

  // "Кто видит ваши данные" at a glance; the choice itself is on Профиль.
  const settings = new Resource(privacy.key, privacy.fetch);
  void settings.load();
</script>

<section class="m3-card" aria-labelledby="home-audiences">
  <div class="head">
    <h2 id="home-audiences" class="m3-section-title">Кто видит ваши данные</h2>
    <a class="m3-btn text small" href={href('/me')} aria-label="Изменить, кто видит ваши данные"
      >Изменить</a
    >
  </div>
  <Loadable resource={settings} loadingLabel="Загружаем настройки">
    {#snippet children(data)}
      <dl class="audiences">
        <div>
          <dt>Расписание</dt>
          <dd>{AUDIENCE[data.scheduleVisibility]}</dd>
        </div>
        <div>
          <dt>Спорт</dt>
          <dd>{AUDIENCE[data.sportVisibility]}</dd>
        </div>
        <div>
          <dt>Список друзей</dt>
          <dd>{AUDIENCE[data.friendsVisibility]}</dd>
        </div>
      </dl>
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить настройки" onretry={() => settings.load()} />
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
  .audiences {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin: 0;
  }
  .audiences div {
    padding: 12px 16px;
    border-radius: var(--md-shape-lg);
    background: var(--md-surface-container-lowest);
  }
  :global([data-theme='dark']) .audiences div {
    background: var(--md-surface-container-high);
  }
  dt {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  dd {
    margin: 2px 0 0;
    font: var(--md-title-medium);
  }
  @media (max-width: 520px) {
    .audiences {
      grid-template-columns: minmax(0, 1fr);
    }
    .audiences div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
    }
  }
</style>
