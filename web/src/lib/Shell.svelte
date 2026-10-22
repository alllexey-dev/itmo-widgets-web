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
  import LoadError from './LoadError.svelte';
  import { RAIL, type PageTable } from './navigation';
  import NotFound from './NotFound.svelte';
  import { href, router, type RouteName } from './router.svelte';
  import { displayName, hasAccess, roleLabel, session } from './session.svelte';

  const RELOADED = 'iw-section-reload';

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

  // Sections load on first visit; the loaded component is kept per route name.
  let loaded = $state<Partial<Record<RouteName, Component>>>({});
  let failed = $state<Partial<Record<RouteName, unknown>>>({});
  $effect(() => {
    const name = router.route.name;
    if (!entry || !allowed || loaded[name] || failed[name]) return;
    void track(entry.load()).then(
      (module) => {
        sessionStorage.removeItem(RELOADED);
        loaded[name] = module.default;
      },
      (error: unknown) => {
        // After a deploy the old hashed chunks are gone: one reload picks up the new build.
        if (sessionStorage.getItem(RELOADED)) {
          failed[name] = error;
          return;
        }
        sessionStorage.setItem(RELOADED, '1');
        location.reload();
      },
    );
  });
  const PageComponent = $derived(loaded[router.route.name]);
  const loadError = $derived(failed[router.route.name]);

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
      Object.values(pages).forEach((page) => void track(page.load()).catch(() => undefined));
    };
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(prefetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(prefetch, 1500);
    return () => clearTimeout(id);
  });
</script>

<AppShell brand="ITMO.Widgets" brandHref={href('/')} {items}>
  {#snippet account({ expanded })}
    {#if user}
      <div class="account" class:collapsed={!expanded}>
        <a class="who" href={href('/me')} aria-label="Профиль: {displayName(user)}">
          <Account
            name={displayName(user)}
            src={user.pictureUrl ?? ''}
            status={roleLabel(user) ?? `ИСУ ${user.isu}`}
          />
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
    {:else if PageComponent}
      {#key router.route}
        <PageComponent />
      {/key}
    {:else if loadError}
      <LoadError
        error={loadError}
        title="Не удалось открыть раздел"
        onretry={() => (failed[router.route.name] = undefined)}
      />
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
    title="Подтвердите вход на телефоне"
    text="Для действий модератора и администратора вход подтверждается раз в 7 дней. Отсканируйте QR-код в приложении, и эта страница откроется снова."
    icon="lock"
    shape="sunny"
    onclose={() => (session.reauth = false)}
  >
    {#snippet actions()}
      <button class="m3-btn text" onclick={() => (session.reauth = false)}>Не сейчас</button>
      <button class="m3-btn" onclick={() => session.reauthenticate()}>Подтвердить</button>
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
  .account.collapsed {
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
    .account.collapsed {
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
