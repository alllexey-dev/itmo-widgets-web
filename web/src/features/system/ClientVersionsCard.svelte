<script lang="ts">
  import {
    ButtonGroup,
    EmptyState,
    Loadable,
    Meter,
    Resource,
    type GroupOption,
  } from '@alllexey/ui';
  import { buildLabel, channelLabel, isPrerelease } from '../../lib/appBuild';
  import { formatNumber } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { CLIENT_VERSIONS_PATH, fetchClientVersions } from './api';
  import { groupBuilds, type VersionGroup } from './clientVersions';
  import { PLATFORM_NAMES } from './labels';
  import type { ClientVersions } from './types';

  // Active devices by the build they last reported; both periods come in one answer.
  type Period = keyof ClientVersions;
  const PERIODS: GroupOption<Period>[] = [
    { value: 'last7d', label: '7 дней' },
    { value: 'last30d', label: '30 дней' },
  ];
  const percent = new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 });

  const versions = new Resource<ClientVersions>(CLIENT_VERSIONS_PATH, fetchClientVersions);
  void versions.load();
  let period = $state<Period>('last7d');

  const shown = $derived(versions.data?.[period]);
  const groups = $derived(shown ? groupBuilds(shown.builds) : []);
  const prerelease = $derived(
    groups.filter((group) => isPrerelease(group.version)).reduce((sum, g) => sum + g.devices, 0),
  );
  const share = (devices: number) => percent.format(shown ? devices / shown.activeDevices : 0);
  const channelLine = (group: VersionGroup) =>
    group.channels
      .map(
        (item) =>
          `${PLATFORM_NAMES[item.platform]}, ${channelLabel(item.distribution)}: ${formatNumber(item.devices)}`,
      )
      .join(' · ');
</script>

<section class="m3-card card" aria-labelledby="system-clients">
  <header class="head">
    <h2 class="m3-section-title" id="system-clients">Версии приложения</h2>
    <ButtonGroup small label="Период" options={PERIODS} bind:value={period} />
  </header>
  <p class="m3-body-medium m3-muted lead">
    Устройства, активные за период, по последней версии, с которой они заходили
  </p>
  <Loadable resource={versions} loadingLabel="Загружаем версии">
    {#snippet children(data)}
      {@const shown = data[period]}
      {#if shown.activeDevices === 0}
        <EmptyState
          icon="smartphone"
          title="Активных устройств нет"
          text="За этот период приложением никто не пользовался"
        />
      {:else}
        <dl class="stats">
          <div>
            <dt>активных устройств</dt>
            <dd class="m3-num">{formatNumber(shown.activeDevices)}</dd>
          </div>
          <div>
            <dt>на бета-версиях</dt>
            <dd class="m3-num">{formatNumber(prerelease)}</dd>
            <dd class="m3-num caption">{share(prerelease)}</dd>
          </div>
          <div>
            <dt>версия неизвестна</dt>
            <dd class="m3-num">{formatNumber(shown.unknownDevices)}</dd>
            <dd class="caption">≤ 2.2 или не обновлялись</dd>
          </div>
        </dl>
        <ul class="m3-segmented" aria-label="Устройства по версиям">
          {#each groups as group (group.key)}
            <li class="build">
              <span class="line">
                <span class="m3-title-small name">{buildLabel(group.version, group.build)}</span>
                {#if isPrerelease(group.version)}<span class="m3-pill tertiary">бета</span>{/if}
                <span class="figures">
                  <span class="m3-title-small m3-num count">{formatNumber(group.devices)}</span>
                  <span class="m3-body-small m3-num m3-muted share">{share(group.devices)}</span>
                </span>
              </span>
              <span class="meter" aria-hidden="true">
                <Meter value={group.devices} max={shown.activeDevices} />
              </span>
              <span class="m3-body-small m3-muted">{channelLine(group)}</span>
            </li>
          {/each}
          {#if shown.unknownDevices > 0}
            <li class="build">
              <span class="line">
                <span class="m3-title-small name">Версия неизвестна</span>
                <span class="figures">
                  <span class="m3-title-small m3-num count"
                    >{formatNumber(shown.unknownDevices)}</span
                  >
                  <span class="m3-body-small m3-num m3-muted share"
                    >{share(shown.unknownDevices)}</span
                  >
                </span>
              </span>
              <span class="meter" aria-hidden="true">
                <Meter value={shown.unknownDevices} max={shown.activeDevices} />
              </span>
              <span class="m3-body-small m3-muted">≤ 2.2 или не обновлялись</span>
            </li>
          {/if}
        </ul>
      {/if}
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить версии" onretry={() => versions.load()} />
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
  .stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 88px), 1fr));
    gap: 12px;
    margin: 0 0 20px;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  dt {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  dd {
    margin: 0;
    font: var(--md-headline-small);
    font-variant-numeric: tabular-nums;
  }
  dd.caption {
    font: var(--md-body-small);
    color: var(--md-on-surface-variant);
  }
  .build {
    display: grid;
    gap: 6px;
    padding: 12px 16px;
  }
  /* On a phone a long version wraps instead of losing its build number. */
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    min-width: 0;
  }
  .name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .line .m3-pill {
    flex: none;
  }
  .figures {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-left: auto;
    white-space: nowrap;
  }
  .share {
    min-width: 52px;
    text-align: right;
  }
</style>
