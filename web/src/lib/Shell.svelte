<script lang="ts">
  import {
    Account,
    AppShell,
    Dialog,
    EmptyState,
    Icon,
    LoadingIndicator,
    Page,
    snackbars,
    type NavItem,
  } from '@alllexey/ui';
  import type { Component } from 'svelte';
  import { onMount } from 'svelte';
  import { errorText } from '../api/errors';
  import Forbidden from './Forbidden.svelte';
  import { track } from './lazy';
  import { RAIL, type LazyPage, type PageTable } from './navigation';
  import NotFound from './NotFound.svelte';
  import PlannedSection from './PlannedSection.svelte';
  import { href, router, type RouteName } from './router.svelte';
  import { displayName, hasAccess, roleLabel, session } from './session.svelte';
  import { theme } from './theme.svelte';

  let { pages }: { pages: PageTable } = $props();

  const user = $derived(session.user);
  const items = $derived<NavItem[]>(
    RAIL.filter((item) => hasAccess(user, item.access)).map((item) => ({
      href: href(item.path),
      label: item.label,
      icon: item.icon,
      active: item.section === router.current.section,
    })),
  );
  const entry = $derived(
    router.route.name === 'notFound' || router.route.name === 'login'
      ? null
      : pages[router.route.name],
  );
  const allowed = $derived(hasAccess(user, router.current.access));

  // Built sections load on first visit; the loaded component is kept per route name.
  let loaded = $state<Partial<Record<RouteName, Component>>>({});
  $effect(() => {
    const name = router.route.name;
    if (!entry || !('load' in entry) || !allowed || loaded[name]) return;
    void track(entry.load()).then((module) => (loaded[name] = module.default));
  });
  const PageComponent = $derived(loaded[router.route.name]);

  let leaving = $state(false);
  async function logout() {
    leaving = true;
    try {
      await session.logout();
    } catch (error) {
      snackbars.error(errorText(error, 'Не удалось выйти'));
    } finally {
      leaving = false;
    }
  }

  onMount(() => {
    void session.ensure();
    // Prefetch the sections this user can open once the browser is idle.
    const prefetch = () => {
      if (!session.user) return;
      Object.values(pages)
        .filter((page): page is LazyPage => 'load' in page)
        .forEach((page) => void track(page.load()));
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  });
</script>

<AppShell brand="ITMO.Widgets" brandHref={href('/')} {items} {theme}>
  {#snippet account()}
    {#if user}
      <div class="account">
        <a class="who" href={href('/me')} aria-label="Профиль: {displayName(user)}">
          <Account name={displayName(user)} status={roleLabel(user) ?? `ИСУ ${user.isu}`} />
        </a>
        <button
          class="m3-icon-btn out"
          onclick={logout}
          disabled={leaving}
          aria-label="Выйти"
          title="Выйти"
        >
          <Icon name="logout" />
        </button>
      </div>
    {/if}
  {/snippet}
  <Page>
    {#if session.status === 'failed'}
      <EmptyState
        error
        title="Не удалось загрузить профиль"
        text={errorText(session.error, 'Попробуйте ещё раз')}
      >
        <button class="m3-btn tonal" onclick={() => session.reload()}>Повторить</button>
      </EmptyState>
    {:else if !user}
      <div class="waiting"><LoadingIndicator size={56} /></div>
    {:else if router.route.name === 'notFound' || !entry}
      <NotFound />
    {:else if !allowed}
      <Forbidden access={router.current.access} />
    {:else if 'title' in entry}
      <PlannedSection title={entry.title} text={entry.text} />
    {:else if PageComponent}
      {#key router.route}
        <PageComponent />
      {/key}
    {:else}
      <div class="waiting"><LoadingIndicator size={56} /></div>
    {/if}
  </Page>
</AppShell>

{#if session.lost}
  <Dialog
    title="Сессия истекла"
    text="Войдите заново, чтобы продолжить."
    icon="lock"
    shape="sunny"
    tone="error"
    modal
  >
    {#snippet actions()}
      <button class="m3-btn" onclick={() => session.signInAgain()}>Войти</button>
    {/snippet}
  </Dialog>
{:else if session.reauth}
  <Dialog
    title="Для действий администратора войдите заново"
    text="Подтвердите вход в приложении, и эта страница откроется снова."
    icon="lock"
    shape="sunny"
    onclose={() => (session.reauth = false)}
  >
    {#snippet actions()}
      <button class="m3-btn text" onclick={() => (session.reauth = false)}>Не сейчас</button>
      <button class="m3-btn" onclick={() => session.reauthenticate()}>Войти</button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .account {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .who {
    flex: 1;
    min-width: 0;
    color: inherit;
    text-decoration: none;
    border-radius: var(--md-shape-lg);
  }
  .who:focus-visible {
    outline: 3px solid var(--md-secondary);
    outline-offset: 2px;
  }
  .out {
    flex: none;
  }
  /* The collapsed rail is 96 px wide: "Выйти" goes under the avatar instead of next to the name. */
  :global(.shell:not(.expanded)) .account {
    flex-direction: column;
    align-items: flex-start;
  }
  @media (max-width: 1100px) {
    .account {
      flex-direction: column;
      align-items: flex-start;
    }
  }
  @media (max-width: 760px) {
    .account,
    :global(.shell:not(.expanded)) .account {
      flex-direction: row;
      align-items: center;
    }
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 40vh;
  }
</style>
