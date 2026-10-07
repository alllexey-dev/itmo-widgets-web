<script lang="ts">
  import { Dialog } from '@alllexey/ui';
  import { ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import { act } from './api';
  import { ISU_PATTERN } from './labels';
  import type { UserProfile } from './types';

  // "Добавить" by ISU number; the error stays under the field. Finding someone by name needs My ITMO,
  // which only the app reads.
  let {
    self,
    onsent,
    onclose,
  }: { self: number; onsent: (profile: UserProfile) => void; onclose: () => void } = $props();

  let isu = $state('');
  let error = $state('');
  let sending = $state(false);

  async function send(event: SubmitEvent) {
    event.preventDefault();
    const value = isu.trim();
    if (!ISU_PATTERN.test(value)) {
      error = 'Номер ИСУ — шесть цифр';
      return;
    }
    if (Number(value) === self) {
      error = 'Это ваш номер';
      return;
    }
    sending = true;
    try {
      onsent(await act(Number(value), 'request'));
    } catch (failure) {
      error =
        failure instanceof ApiError && failure.status === 404
          ? 'Этого человека нет в ITMO.Widgets'
          : errorText(failure, 'Не удалось отправить заявку');
    } finally {
      sending = false;
    }
  }
</script>

<Dialog
  title="Добавить в друзья"
  text="Найти человека по имени можно в приложении. Здесь — по номеру ИСУ."
  icon="person_add"
  {onclose}
>
  <form id="add-friend" class="field" onsubmit={send} novalidate>
    <label for="add-friend-isu">Номер ИСУ</label>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      id="add-friend-isu"
      class="m3-field"
      inputmode="numeric"
      autocomplete="off"
      maxlength="9"
      autofocus
      bind:value={isu}
      oninput={() => (error = '')}
      aria-invalid={error ? 'true' : undefined}
      aria-describedby={error ? 'add-friend-error' : undefined}
    />
    {#if error}<span id="add-friend-error" class="m3-body-small error">{error}</span>{/if}
  </form>
  {#snippet actions()}
    <button class="m3-btn text" onclick={onclose}>Отмена</button>
    <button class="m3-btn" type="submit" form="add-friend" disabled={sending}>
      Отправить заявку
    </button>
  {/snippet}
</Dialog>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  label {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .m3-field {
    width: 100%;
    box-sizing: border-box;
    font-size: 16px;
  }
  .error {
    color: var(--md-error);
  }
</style>
