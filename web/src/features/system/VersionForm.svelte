<script lang="ts">
  import { snackbars, TextField } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { errorText } from '../../api/errors';
  import { saveVersion } from './api';
  import { formatDateTime } from './format';
  import type { AppVersion, Platform } from './types';
  import { compareVersions, NOTE_LIMIT, versionError } from './version';

  // The editor of one platform's versions; the card remounts it when the saved values change.
  let {
    platform,
    saved,
    onsaved,
  }: { platform: Platform; saved: AppVersion; onsaved: (version: AppVersion) => void } = $props();

  let latest = $state(untrack(() => saved.latest));
  let minimum = $state(untrack(() => saved.minimum));
  let note = $state(untrack(() => saved.note));
  let saving = $state(false);

  const latestError = $derived(versionError(latest));
  const minimumError = $derived(
    versionError(minimum) ??
      (!latestError && compareVersions(minimum, latest) > 0 ? 'Не выше последней' : undefined),
  );
  const noteError = $derived(
    note.trim().length > NOTE_LIMIT ? `Не больше ${NOTE_LIMIT} символов` : undefined,
  );
  const dirty = $derived(
    latest.trim() !== saved.latest ||
      minimum.trim() !== saved.minimum ||
      note.trim() !== saved.note,
  );
  const valid = $derived(!latestError && !minimumError && !noteError);

  function reset() {
    latest = saved.latest;
    minimum = saved.minimum;
    note = saved.note;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!dirty || !valid || saving) return;
    saving = true;
    try {
      const version = await saveVersion(platform, {
        latest: latest.trim(),
        minimum: minimum.trim(),
        note: note.trim(),
      });
      snackbars.show('Версия сохранена');
      onsaved(version);
    } catch (error) {
      snackbars.error(
        errorText(error, 'Не удалось сохранить версию', {
          invalid_request_data: 'Проверьте версии и заметку',
          invalid_request: 'Проверьте версии и заметку',
        }),
      );
    } finally {
      saving = false;
    }
  }
</script>

<form class="form" onsubmit={submit}>
  <div class="row">
    <TextField
      label="Последняя"
      autocomplete="off"
      spellcheck="false"
      bind:value={latest}
      error={dirty ? latestError : ''}
    />
    <TextField
      label="Минимальная"
      autocomplete="off"
      spellcheck="false"
      bind:value={minimum}
      error={dirty ? minimumError : ''}
    />
  </div>
  <TextField
    label="Что нового"
    multiline
    rows={3}
    bind:value={note}
    maxlength={NOTE_LIMIT}
    error={noteError}
    hint="Видно в приложении рядом с предложением обновиться"
  />
  <p class="meta m3-body-small m3-muted">
    <span class="m3-pill {saved.overridden ? 'primary' : 'neutral'}">
      {saved.overridden ? 'Из настроек' : 'По умолчанию сервера'}
    </span>
    {#if saved.updatedAt}<span>Изменено {formatDateTime(saved.updatedAt)}</span>{/if}
  </p>
  <div class="actions">
    <button class="m3-btn" type="submit" disabled={!dirty || saving}>Сохранить</button>
    {#if dirty}
      <button class="m3-btn text" type="button" onclick={reset} disabled={saving}>Отменить</button>
    {/if}
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 16px;
  }
  .row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
  }
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
