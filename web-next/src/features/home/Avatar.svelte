<script lang="ts">
  import { Shape } from '@alllexey/ui';
  import { initialsOf } from './student';

  // The photo when it loads, otherwise initials on the cookie shape; decorative, the name is next to it.
  let { name, src, size = 40 }: { name: string; src: string | null; size?: number } = $props();
  let failed = $state<string | null>(null);
</script>

{#if src && failed !== src}
  <img
    class="photo"
    {src}
    alt=""
    width={size}
    height={size}
    referrerpolicy="no-referrer"
    aria-hidden="true"
    onerror={() => (failed = src)}
  />
{:else}
  <span class="initials" class:large={size >= 48} class:huge={size >= 72} aria-hidden="true">
    <Shape
      shape="cookie9"
      {size}
      color="var(--md-tertiary-container)"
      fg="var(--md-on-tertiary-container)"
    >
      {initialsOf(name)}
    </Shape>
  </span>
{/if}

<style>
  .photo {
    flex: none;
    border-radius: 50%;
    object-fit: cover;
  }
  .initials {
    flex: none;
    font: var(--md-label-large);
  }
  .initials.large {
    font: var(--md-title-medium);
  }
  .initials.huge {
    font: var(--md-headline-small);
  }
</style>
