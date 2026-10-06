<script lang="ts">
  import { Snackbars } from '@alllexey/ui';
  import LoginPage from './features/auth/LoginPage.svelte';
  import { router } from './lib/router.svelte';
  import Shell from './lib/Shell.svelte';
  import { pages } from './pages';
</script>

{#if router.route.name === 'login'}
  <LoginPage />
{:else}
  <Shell {pages} />
{/if}

<Snackbars />
