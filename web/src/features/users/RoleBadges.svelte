<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import type { Role } from '../../lib/session.svelte';

  // Role pills, admin first; nothing for a user without roles.
  let { roles }: { roles: readonly Role[] } = $props();
</script>

{#if roles.includes('ADMIN')}
  <span class="m3-pill primary"><Icon name="shield_person" size={16} />Администратор</span>
{/if}
{#if roles.includes('MODERATOR')}
  <span class="m3-pill tertiary"><Icon name="gavel" size={16} />Модератор</span>
{/if}
