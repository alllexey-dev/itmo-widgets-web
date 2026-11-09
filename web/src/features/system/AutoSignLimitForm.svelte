<script lang="ts">
  import { snackbars, TextField } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { errorText } from '../../api/errors';
  import { saveSportSettings } from './api';
  import { formatDateTime } from '../../lib/format';
  import type { SportSettings } from './types';

  // Every user's monthly auto-sign limit; the card remounts the form when the saved value changes.
  let { saved, onsaved }: { saved: SportSettings; onsaved: (settings: SportSettings) => void } =
    $props();

  const MAX = 100;

  let value = $state(untrack(() => String(saved.autoSignLimit)));
  let saving = $state(false);

  const limit = $derived(/^\s*\d+\s*$/.test(value) ? Number(value) : NaN);
  const error = $derived(Number.isInteger(limit) && limit <= MAX ? '' : `От 0 до ${MAX}`);
  const dirty = $derived(limit !== saved.autoSignLimit);

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!dirty || error || saving) return;
    saving = true;
    try {
      const settings = await saveSportSettings({ autoSignLimit: limit });
      snackbars.show('Лимит сохранён');
      onsaved(settings);
    } catch (failure) {
      snackbars.error(
        errorText(failure, 'Не удалось сохранить лимит', {
          invalid_request_data: `Лимит — от 0 до ${MAX}`,
          invalid_request: `Лимит — от 0 до ${MAX}`,
        }),
      );
    } finally {
      saving = false;
    }
  }
</script>

<form class="form" onsubmit={submit}>
  <TextField
    label="Лимит автозаписи в месяц"
    inputmode="numeric"
    autocomplete="off"
    spellcheck="false"
    bind:value
    hint="Для каждого за 30 дней, 0 — новые записи выключены"
    {error}
  />
  <p class="meta m3-body-small m3-muted">
    <span class="m3-pill {saved.overridden ? 'primary' : 'neutral'}">
      {saved.overridden ? 'Из настроек' : 'По умолчанию сервера'}
    </span>
    {#if saved.updatedAt}<span>Изменено {formatDateTime(saved.updatedAt)}</span>{/if}
  </p>
  <div>
    <button class="m3-btn" type="submit" disabled={!dirty || saving}>Сохранить</button>
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 16px;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
</style>
