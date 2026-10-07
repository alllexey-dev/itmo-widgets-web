<script lang="ts">
  import { Dialog, snackbars } from '@alllexey/ui';
  import { ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import { replaceCredential } from './api';
  import { CREDENTIAL_HINTS, CREDENTIALS } from './labels';
  import TextField from './TextField.svelte';
  import type { ServiceCredential, ServiceCredentialKey } from './types';

  // The value lives only in this password field and the request body; it is never shown back.
  // The dialog unmounts on close, so the field is empty the next time.
  let {
    credential,
    onreplaced,
    onclose,
  }: {
    credential: ServiceCredentialKey;
    onreplaced: (credentials: ServiceCredential[]) => void;
    onclose: () => void;
  } = $props();

  const formId = $props.id();
  let value = $state('');
  let invalid = $state(false);
  let busy = $state(false);
  const trimmed = $derived(value.trim());

  $effect(() => {
    if (value) invalid = false;
  });

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!trimmed || busy) return;
    busy = true;
    try {
      const credentials = await replaceCredential(credential, trimmed);
      value = '';
      snackbars.show('Значение заменено');
      onreplaced(credentials);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) invalid = true;
      else snackbars.error(errorText(error, 'Не удалось заменить значение'));
    } finally {
      busy = false;
    }
  }

  function close() {
    value = '';
    onclose();
  }
</script>

<Dialog
  title="Заменить значение"
  text={CREDENTIALS[credential]}
  icon="key"
  modal={busy}
  onclose={close}
>
  <form id={formId} onsubmit={submit}>
    <TextField
      label="Новое значение"
      type="password"
      bind:value
      hint={CREDENTIAL_HINTS[credential] ?? ''}
      error={invalid ? 'Проверьте значение' : ''}
    />
  </form>
  {#snippet actions()}
    <button class="m3-btn text" type="button" onclick={close} disabled={busy}>Отмена</button>
    <button class="m3-btn" type="submit" form={formId} disabled={!trimmed || busy}>Заменить</button>
  {/snippet}
</Dialog>
