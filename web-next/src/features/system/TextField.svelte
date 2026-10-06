<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  // A labelled field: the label above, the error (or the hint) below and in the accessible description.
  let {
    label,
    value = $bindable(''),
    hint = '',
    error = '',
    multiline = false,
    type = 'text',
    inputmode,
    maxlength,
  }: {
    label: string;
    value?: string;
    hint?: string;
    error?: string;
    multiline?: boolean;
    type?: 'text' | 'password';
    inputmode?: HTMLInputAttributes['inputmode'];
    maxlength?: number;
  } = $props();

  const id = $props.id();
  const note = $derived(error || hint);
</script>

<div class="field" class:invalid={!!error}>
  <label class="m3-label-large" for={id}>{label}</label>
  {#if multiline}
    <textarea
      class="m3-field"
      {id}
      rows="3"
      {maxlength}
      bind:value
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? `${id}-note` : undefined}></textarea>
  {:else}
    <input
      class="m3-field"
      {id}
      {type}
      {inputmode}
      {maxlength}
      autocomplete="off"
      spellcheck="false"
      bind:value
      aria-invalid={error ? true : undefined}
      aria-describedby={note ? `${id}-note` : undefined}
    />
  {/if}
  {#if note}
    <span class="note m3-body-small" id="{id}-note">{note}</span>
  {/if}
</div>

<style>
  .field {
    display: grid;
    gap: 6px;
    min-width: 0;
  }
  label {
    color: var(--md-on-surface-variant);
  }
  .m3-field {
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  textarea.m3-field {
    height: auto;
    min-height: 96px;
    padding: 14px 16px;
    resize: vertical;
    font: var(--md-body-large);
  }
  .note {
    color: var(--md-on-surface-variant);
  }
  .invalid .note,
  .invalid label {
    color: var(--md-error);
  }
  .invalid .m3-field {
    border-bottom: 2px solid var(--md-error);
  }
</style>
