<script lang="ts">
  import { ButtonGroup, Loadable, Resource } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { fetchVersion, supportsIos, versionKey } from './api';
  import { PLATFORMS } from './labels';
  import type { AppVersion, Platform } from './types';
  import VersionForm from './VersionForm.svelte';

  // Android always; iOS only on a Backend that keeps the platforms apart (see `supportsIos`).
  const versionOf = (platform: Platform) =>
    new Resource<AppVersion>(versionKey(platform), () => fetchVersion(platform));
  const versions: Record<Platform, Resource<AppVersion>> = {
    ANDROID: versionOf('ANDROID'),
    IOS: versionOf('IOS'),
  };
  let ios = $state(false);
  let platform = $state<Platform>('ANDROID');
  const version = $derived(versions[platform]);

  void versions.ANDROID.load();
  void supportsIos().then((supported) => (ios = supported));

  $effect(() => {
    const current = versions[platform];
    if (!current.data && !current.loading && !current.error) void current.load();
  });
</script>

<section class="m3-card card" aria-labelledby="system-version">
  <header class="head">
    <h2 class="m3-section-title" id="system-version">Версия приложения</h2>
    {#if ios}
      <ButtonGroup small label="Платформа" options={PLATFORMS} bind:value={platform} />
    {/if}
  </header>
  <p class="m3-body-medium m3-muted lead">
    Приложение предлагает обновиться до последней версии и требует минимальную
  </p>
  <Loadable resource={version} loadingLabel="Загружаем версию">
    {#snippet children(data)}
      {#key `${platform}:${data.updatedAt ?? 'env'}`}
        <VersionForm
          {platform}
          saved={data}
          onsaved={(saved) => (versions[platform].data = saved)}
        />
      {/key}
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить версию" onretry={() => version.load()} />
    {/snippet}
  </Loadable>
</section>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 4px;
  }
  .head h2 {
    margin: 0;
  }
  .lead {
    margin: 0 0 16px;
  }
</style>
