<script lang="ts">
  import { LoadingIndicator, revalidate, StatusShape } from '@alllexey/ui';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href } from '../../lib/router.svelte';
  import { awaitsCheck, CREDENTIALS_PATH, fetchCredentials, POLL_MILLIS } from './api';
  import { formatDate, formatDateTime, formatRelative } from './format';
  import { CREDENTIAL_SOURCES, CREDENTIAL_STATUSES, CREDENTIALS } from './labels';
  import ReplaceCredentialDialog from './ReplaceCredentialDialog.svelte';
  import type { ServiceCredential, ServiceCredentialKey } from './types';

  // Values never reach the browser: the list carries states, times and who changed them.
  const credentials = new Resource<ServiceCredential[]>(CREDENTIALS_PATH, fetchCredentials);
  void credentials.load();

  let replacing = $state<ServiceCredentialKey | null>(null);
  let failedPolls = $state(0);

  // Quietly re-read the list while a fresh value waits for its first use.
  $effect(() => {
    const list = credentials.data;
    void failedPolls;
    if (!list || !awaitsCheck(list)) return;
    const timer = setTimeout(() => {
      revalidate(CREDENTIALS_PATH, fetchCredentials, (data) => (credentials.data = data)).catch(
        () => (failedPolls += 1),
      );
    }, POLL_MILLIS);
    return () => clearTimeout(timer);
  });

  const failed = (credential: ServiceCredential) =>
    credential.status === 'FAILED' || credential.status === 'EXPIRED';
</script>

<section class="m3-card flush" aria-labelledby="system-credentials">
  <h2 class="m3-section-title title" id="system-credentials">Ключи и доступы</h2>
  {#if credentials.data}
    <div class="m3-table" role="table" aria-label="Ключи и доступы">
      <div class="tr th" role="row">
        <span role="columnheader">Ключ</span>
        <span role="columnheader">Состояние</span>
        <span role="columnheader">Истекает</span>
        <span role="columnheader">Изменено</span>
        <span role="columnheader" aria-label="Действия"></span>
      </div>
      {#each credentials.data as credential (credential.key)}
        {@const status = CREDENTIAL_STATUSES[credential.status]}
        <div class="tr" role="row">
          <span role="cell" class="stack">
            <span>{CREDENTIALS[credential.key]}</span>
            <span class="m3-body-small m3-muted">
              {credential.lastUsedAt
                ? `использован ${formatRelative(credential.lastUsedAt)}`
                : 'не использовался'}
            </span>
          </span>
          <span role="cell" class="stack">
            <span class="state"><StatusShape tone={status.tone} />{status.label}</span>
            {#if failed(credential) && credential.lastError}
              <code class="m3-mono m3-body-small error">{credential.lastError}</code>
            {/if}
            {#if failed(credential) && credential.lastErrorAt}
              <span class="m3-body-small m3-muted">{formatDateTime(credential.lastErrorAt)}</span>
            {/if}
          </span>
          <span role="cell" class="stack">
            {#if credential.expiresAt}
              <span class="m3-num">{formatDate(credential.expiresAt)}</span>
            {:else}
              <span class="m3-muted">—</span>
            {/if}
            {#if credential.expiresSoon}<span class="m3-pill warn">Скоро</span>{/if}
          </span>
          <span role="cell" class="stack">
            <span class="m3-num">{formatDateTime(credential.updatedAt)}</span>
            {#if credential.updatedSource === 'ADMIN' && credential.updatedByIsu !== null}
              <a class="m3-body-small" href={href(`/admin/users/${credential.updatedByIsu}`)}>
                {credential.updatedByName ?? `ИСУ ${credential.updatedByIsu}`}
              </a>
            {:else if credential.updatedSource && credential.updatedSource !== 'ADMIN'}
              <span class="m3-body-small m3-muted">
                {CREDENTIAL_SOURCES[credential.updatedSource]}
              </span>
            {/if}
          </span>
          <span role="cell" class="end">
            {#if credential.replaceable}
              <button
                class="m3-btn text small"
                aria-label="Заменить: {CREDENTIALS[credential.key]}"
                onclick={() => (replacing = credential.key)}>Заменить</button
              >
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {:else if credentials.error}
    <div class="pad">
      <LoadError
        error={credentials.error}
        title="Не удалось загрузить ключи"
        onretry={() => credentials.load()}
      />
    </div>
  {:else}
    <div class="pad"><LoadingIndicator label="Загружаем ключи" /></div>
  {/if}
</section>

{#if replacing}
  <ReplaceCredentialDialog
    credential={replacing}
    onreplaced={(list) => {
      credentials.data = list;
      replacing = null;
    }}
    onclose={() => (replacing = null)}
  />
{/if}

<style>
  .title {
    padding: 20px 24px 0;
  }
  .pad {
    padding: 0 24px 24px;
  }
  .tr {
    grid-template-columns: minmax(180px, 1.6fr) minmax(150px, 1.2fr) 110px minmax(130px, 1fr) 112px;
    min-width: 760px;
  }
  .stack {
    display: grid;
    gap: 2px;
    justify-items: start;
    min-width: 0;
  }
  .state {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .error {
    overflow-wrap: anywhere;
    color: var(--md-error);
  }
  .end {
    text-align: right;
  }
</style>
