<script lang="ts">
  import { Dialog } from '@alllexey/ui';
  import { CAPABILITIES } from './labels';
  import type { DecisionRequest, RestrictionCapability } from './types';

  // Restricting keeps the case open; the reason is required because the author sees it in the app.
  let {
    authorName,
    defaultCapability,
    saving,
    onsubmit,
    onclose,
  }: {
    authorName: string;
    defaultCapability: RestrictionCapability;
    saving: boolean;
    onsubmit: (request: DecisionRequest) => void;
    onclose: () => void;
  } = $props();

  const LIMIT = 500;
  const CAPABILITY_OPTIONS = Object.entries(CAPABILITIES) as [RestrictionCapability, string][];
  const TERMS = [
    ['1', '1 день'],
    ['3', '3 дня'],
    ['7', '7 дней'],
    ['30', '30 дней'],
    ['90', '90 дней'],
    ['forever', 'Бессрочно'],
  ] as const;

  // The dialog opens fresh for every author, so the initial capability is read once.
  // svelte-ignore state_referenced_locally
  let capability = $state<RestrictionCapability>(defaultCapability);
  let term = $state<(typeof TERMS)[number][0]>('7');
  let note = $state('');
  const trimmed = $derived(note.trim());
  const valid = $derived(trimmed.length > 0 && trimmed.length <= LIMIT);

  function submit() {
    if (!valid || saving) return;
    onsubmit({
      action: 'RESTRICT_USER',
      note: trimmed,
      restriction: term === 'forever' ? { capability } : { capability, days: Number(term) },
    });
  }
</script>

<Dialog
  title="Ограничить автора"
  text="{authorName} не сможет выбранное действие. Заявка останется открытой."
  onclose={() => !saving && onclose()}
>
  <div class="row">
    <div class="mod-field">
      <label for="restrict-capability">Что запретить</label>
      <select id="restrict-capability" class="m3-field" bind:value={capability}>
        {#each CAPABILITY_OPTIONS as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </div>
    <div class="mod-field">
      <label for="restrict-term">Срок</label>
      <select id="restrict-term" class="m3-field" bind:value={term}>
        {#each TERMS as [value, label] (value)}
          <option {value}>{label}</option>
        {/each}
      </select>
    </div>
  </div>
  <div class="mod-field">
    <label for="restrict-note">Причина</label>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      id="restrict-note"
      class="m3-field"
      bind:value={note}
      maxlength={LIMIT}
      autofocus
      aria-describedby="restrict-hint"
      onkeydown={(event) => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) submit();
      }}></textarea>
    <small id="restrict-hint">Автор увидит её в приложении</small>
  </div>
  {#snippet actions()}
    <button class="m3-btn text" disabled={saving} onclick={onclose}>Отмена</button>
    <button class="m3-btn danger" disabled={!valid || saving} onclick={submit}>Ограничить</button>
  {/snippet}
</Dialog>

<style>
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  @media (max-width: 420px) {
    .row {
      grid-template-columns: 1fr;
    }
  }
</style>
