<script lang="ts">
  import { Dialog, Icon } from '@alllexey/ui';
  import type { DecisionRequest } from './types';

  // The reason is required: the author sees it in the app instead of the Backend's technical fallback.
  let {
    title,
    presets,
    saving,
    onsubmit,
    onclose,
  }: {
    title: string;
    presets: readonly string[];
    saving: boolean;
    onsubmit: (request: DecisionRequest) => void;
    onclose: () => void;
  } = $props();

  const LIMIT = 500;
  let note = $state('');
  const trimmed = $derived(note.trim());
  const valid = $derived(trimmed.length > 0 && trimmed.length <= LIMIT);

  function submit() {
    if (valid && !saving) onsubmit({ action: 'REJECT', note: trimmed });
  }
</script>

<Dialog {title} text="Автор увидит причину в приложении." onclose={() => !saving && onclose()}>
  <div class="presets" role="group" aria-label="Частые причины">
    {#each presets as preset (preset)}
      {@const selected = trimmed === preset}
      <button
        class="m3-chip"
        class:selected
        aria-pressed={selected}
        onclick={() => (note = preset)}
      >
        {#if selected}<Icon name="check" size={18} />{/if}{preset}
      </button>
    {/each}
  </div>
  <div class="mod-field">
    <label for="reject-note">Причина</label>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      id="reject-note"
      class="m3-field"
      bind:value={note}
      maxlength={LIMIT}
      autofocus
      onkeydown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
      }}></textarea>
    <small class="m3-num">{note.length} / {LIMIT}</small>
  </div>
  {#snippet actions()}
    <button class="m3-btn text" disabled={saving} onclick={onclose}>Отмена</button>
    <button class="m3-btn danger" disabled={!valid || saving} onclick={submit}>Отклонить</button>
  {/snippet}
</Dialog>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
</style>
