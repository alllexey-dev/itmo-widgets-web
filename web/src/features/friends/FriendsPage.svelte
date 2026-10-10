<script lang="ts">
  import {
    Avatar,
    EmptyState,
    forget,
    Icon,
    Loadable,
    PageHeader,
    Resource,
    Search,
    snackbars,
    Tabs,
  } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import { counted } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { href, router } from '../../lib/router.svelte';
  import { session } from '../../lib/session.svelte';
  import AddFriendDialog from './AddFriendDialog.svelte';
  import { act, list, LIST_PATHS, type Tab } from './api';
  import { groupLine, matches, nameOf } from './labels';
  import type { FriendAction, UserProfile } from './types';

  // Friends and requests in three tabs (`tab` in the URL), local search over friends and "Добавить" by
  // ISU number. Every answer reloads the three lists: one action can move a person between them.
  const TABS: { id: Tab; label: string }[] = [
    { id: 'friends', label: 'Друзья' },
    { id: 'incoming', label: 'Входящие' },
    { id: 'outgoing', label: 'Исходящие' },
  ];
  const EMPTY: Record<Tab, { icon: string; title: string; text: string }> = {
    friends: {
      icon: 'group',
      title: 'Друзей пока нет',
      text: 'Добавьте друга по номеру ИСУ или в приложении.',
    },
    incoming: { icon: 'inbox', title: 'Входящих заявок нет', text: '' },
    outgoing: { icon: 'inbox', title: 'Исходящих заявок нет', text: '' },
  };

  const lists: Record<Tab, Resource<UserProfile[]>> = {
    friends: new Resource(LIST_PATHS.friends, () => list('friends')),
    incoming: new Resource(LIST_PATHS.incoming, () => list('incoming')),
    outgoing: new Resource(LIST_PATHS.outgoing, () => list('outgoing')),
  };
  const reload = () => Promise.all(Object.values(lists).map((resource) => resource.load()));
  void reload();

  const tab = $derived<Tab>(
    TABS.find((item) => item.id === router.query.get('tab'))?.id ?? 'friends',
  );
  const current = $derived(lists[tab]);
  let query = $state('');
  const shown = $derived(
    (current.data ?? []).filter((profile) => tab !== 'friends' || matches(profile.user, query)),
  );
  const intro = $derived(
    lists.friends.data && lists.incoming.data
      ? `${counted(lists.friends.data.length, ['друг', 'друга', 'друзей'])} · ${counted(
          lists.incoming.data.length,
          ['заявка', 'заявки', 'заявок'],
        )}`
      : '',
  );

  function select(next: Tab) {
    router.setQuery({ tab: next === 'friends' ? null : next });
  }

  let adding = $state(false);
  let pending = $state<number | null>(null);

  const DONE: Record<Exclude<FriendAction, 'request'>, (name: string) => string> = {
    accept: (name) => `${name} теперь в друзьях`,
    reject: () => 'Заявка отклонена',
    cancel: () => 'Заявка отменена',
  };
  const FAILED: Record<Exclude<FriendAction, 'request'>, string> = {
    accept: 'Не удалось принять заявку',
    reject: 'Не удалось отклонить заявку',
    cancel: 'Не удалось отменить заявку',
  };

  function changed(isu: number) {
    forget('/api/friends');
    forget(`/api/users/${isu}`);
    return reload();
  }

  async function answer(profile: UserProfile, action: Exclude<FriendAction, 'request'>) {
    pending = profile.user.isu;
    try {
      await act(profile.user.isu, action);
      snackbars.show(DONE[action](nameOf(profile.user)));
      await changed(profile.user.isu);
    } catch (error) {
      snackbars.error(errorText(error, FAILED[action]));
    } finally {
      pending = null;
    }
  }

  function sent(profile: UserProfile) {
    adding = false;
    const name = nameOf(profile.user);
    snackbars.show(
      profile.relationship === 'FRIENDS' ? `${name} теперь в друзьях` : 'Заявка отправлена',
    );
    select(profile.relationship === 'FRIENDS' ? 'friends' : 'outgoing');
    void changed(profile.user.isu);
  }
</script>

<PageHeader title="Друзья" text={intro}>
  {#snippet actions()}
    <button class="m3-btn" onclick={() => (adding = true)}>
      <Icon name="person_add" />
      Добавить
    </button>
  {/snippet}
</PageHeader>

<div class="toolbar">
  <div class="tabs-scroll">
    <Tabs
      label="Друзья и заявки"
      options={TABS.map((item) => ({
        value: item.id,
        label: item.label,
        badge: lists[item.id].data?.length,
      }))}
      value={tab}
      onchange={select}
    />
  </div>
  {#if tab === 'friends' && (lists.friends.data?.length ?? 0) > 0}
    <div class="search"><Search bind:value={query} placeholder="Поиск по имени" /></div>
  {/if}
</div>

<div role="tabpanel" aria-label={TABS.find((item) => item.id === tab)?.label}>
  <Loadable resource={current} loadingLabel="Загружаем друзей">
    {#if shown.length > 0}
      <ul class="m3-segmented list" aria-label={TABS.find((item) => item.id === tab)?.label}>
        {#each shown as profile (profile.user.isu)}
          {@const user = profile.user}
          {@const name = nameOf(user)}
          {@const group = user.groups[0]}
          {#if tab === 'friends'}
            <li>
              <a class="m3-list-item" href={href(`/u/${user.isu}`)}>
                <span class="lead"><Avatar {name} src={user.pictureUrl ?? ''} decorative /></span>
                <span class="main">
                  <span class="headline">{name}</span>
                  {#if group}<span class="support">{groupLine(group)}</span>{/if}
                </span>
                <span class="trail"><Icon name="chevron_right" /></span>
              </a>
            </li>
          {:else}
            <li class="m3-list-item request">
              <span class="lead"><Avatar {name} src={user.pictureUrl ?? ''} decorative /></span>
              <span class="main">
                <a class="headline person" href={href(`/u/${user.isu}`)}>{name}</a>
                {#if group}<span class="support">{groupLine(group)}</span>{/if}
              </span>
              <span class="trail actions">
                {#if tab === 'incoming'}
                  <button
                    class="m3-btn tonal small"
                    disabled={pending === user.isu}
                    onclick={() => answer(profile, 'accept')}
                    aria-label="Принять заявку: {name}">Принять</button
                  >
                  <button
                    class="m3-icon-btn"
                    disabled={pending === user.isu}
                    onclick={() => answer(profile, 'reject')}
                    aria-label="Отклонить заявку: {name}"
                    title="Отклонить"
                  >
                    <Icon name="close" />
                  </button>
                {:else}
                  <button
                    class="m3-btn outlined small"
                    disabled={pending === user.isu}
                    onclick={() => answer(profile, 'cancel')}
                    aria-label="Отменить заявку: {name}">Отменить</button
                  >
                {/if}
              </span>
            </li>
          {/if}
        {/each}
      </ul>
    {:else if query && tab === 'friends'}
      <section class="m3-card">
        <EmptyState icon="search_off" title="Никого не нашли" text="Поиск идёт по вашим друзьям." />
      </section>
    {:else}
      <section class="m3-card">
        <EmptyState icon={EMPTY[tab].icon} title={EMPTY[tab].title} text={EMPTY[tab].text} />
      </section>
    {/if}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить список" onretry={() => current.load()} />
    {/snippet}
  </Loadable>
</div>

{#if adding && session.user}
  <AddFriendDialog self={session.user.isu} onsent={sent} onclose={() => (adding = false)} />
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px 16px;
    margin-bottom: 16px;
  }
  .tabs-scroll {
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .search {
    width: min(360px, 100%);
  }
  .list {
    max-width: 880px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .person {
    color: inherit;
    text-decoration: none;
  }
  .person:hover {
    text-decoration: underline;
  }
  .person:focus-visible {
    outline: 3px solid var(--md-secondary);
    outline-offset: 2px;
    border-radius: var(--md-shape-xs);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  @media (max-width: 520px) {
    .request {
      flex-wrap: wrap;
      row-gap: 4px;
    }
    .request .main {
      flex: 1 1 calc(100% - 72px);
    }
    .actions {
      flex: 1 0 100%;
      justify-content: flex-end;
    }
  }
</style>
