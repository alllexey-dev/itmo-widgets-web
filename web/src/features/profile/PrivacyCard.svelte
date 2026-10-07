<script lang="ts">
  import { ButtonGroup, forget, LoadingIndicator, snackbars, type GroupOption } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { privacy, PRIVACY_PATH, savePrivacy } from './api';
  import { AUDIENCE_ROWS, AUDIENCES } from './labels';
  import type { Audience, PrivacySettings } from './types';

  // "Кто видит": three audiences, each applied at once with all three in the PUT. A failed save puts
  // the previous choice back.
  const settings = new Resource(PRIVACY_PATH, privacy);
  void settings.load();
  const options: GroupOption<Audience>[] = AUDIENCES.map((item) => ({ ...item }));

  async function choose(key: keyof PrivacySettings, value: Audience) {
    const current = settings.data;
    if (!current) return;
    const previous = current[key];
    const next = { ...current, [key]: value };
    settings.data = next;
    try {
      const saved = await savePrivacy(next);
      forget(PRIVACY_PATH);
      // A later choice may already be on screen; keep it and take only this answer's field.
      if (settings.data) settings.data = { ...settings.data, [key]: saved[key] };
      snackbars.show('Настройка сохранена');
    } catch (error) {
      if (settings.data) settings.data = { ...settings.data, [key]: previous };
      snackbars.error(errorText(error, 'Не удалось сохранить настройку'));
    }
  }
</script>

<section class="m3-card" aria-labelledby="profile-privacy">
  <h2 id="profile-privacy" class="m3-section-title">Кто видит</h2>
  <p class="m3-body-medium m3-muted intro">
    Применяется сразу — на сайте и в приложении. «Друзья» — только принятые друзья.
  </p>
  {#if settings.data}
    {@const data = settings.data}
    {#each AUDIENCE_ROWS as row (row.key)}
      <div class="audience">
        <span class="m3-body-large">{row.title}</span>
        <ButtonGroup
          small
          label={row.label}
          {options}
          value={data[row.key]}
          onchange={(value) => choose(row.key, value)}
        />
      </div>
    {/each}
  {:else if settings.error}
    <LoadError
      error={settings.error}
      title="Не удалось загрузить настройки"
      onretry={() => settings.load()}
    />
  {:else}
    <div class="waiting"><LoadingIndicator label="Загружаем настройки" /></div>
  {/if}
</section>

<style>
  .intro {
    margin: -4px 0 8px;
  }
  .audience {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding: 10px 0;
  }
  .audience + .audience {
    border-top: 1px solid var(--md-outline-variant);
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 160px;
  }
  /* On a phone every choice sits under its title, so the three rows look alike. */
  @media (max-width: 520px) {
    .audience {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
