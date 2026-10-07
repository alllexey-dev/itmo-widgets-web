<script lang="ts">
  import {
    ConfirmDialog,
    EmptyState,
    forget,
    Icon,
    LoadingIndicator,
    snackbars,
  } from '@alllexey/ui';
  import { ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href, router } from '../../lib/router.svelte';
  import { session } from '../../lib/session.svelte';
  import { act, profile, profilePath } from './api';
  import Avatar from './Avatar.svelte';
  import FriendsCard from './FriendsCard.svelte';
  import { can, groupLine, nameOf } from './labels';
  import ScheduleCard from './ScheduleCard.svelte';
  import SportCard from './SportCard.svelte';
  import type { FriendAction, UserProfile } from './types';

  // A person as the viewer may see them: the relationship with its one next step and the cards their
  // audiences open. Backend decides every capability; the page only asks for what it was allowed.
  const isu = router.route.name === 'person' ? router.route.isu : 0;
  const person = new Resource(profilePath(isu), () => profile(isu));
  void person.load();

  const self = $derived(session.user?.isu === isu);
  const missing = $derived(person.error instanceof ApiError && person.error.code === 'not_found');

  let pending = $state(false);
  let removing = $state(false);
  // Bumped after a friendship change so the cards ask again even if the capabilities stayed.
  let version = $state(0);

  const DONE: Record<FriendAction, (name: string, next: UserProfile) => string> = {
    request: (name, next) =>
      next.relationship === 'FRIENDS' ? `${name} теперь в друзьях` : 'Заявка отправлена',
    accept: (name) => `${name} теперь в друзьях`,
    reject: () => 'Заявка отклонена',
    cancel: () => 'Заявка отменена',
    remove: () => 'Вы больше не друзья',
  };
  const FAILED: Record<FriendAction, string> = {
    request: 'Не удалось отправить заявку',
    accept: 'Не удалось принять заявку',
    reject: 'Не удалось отклонить заявку',
    cancel: 'Не удалось отменить заявку',
    remove: 'Не удалось удалить из друзей',
  };

  async function change(action: FriendAction) {
    removing = false;
    pending = true;
    try {
      const next = await act(isu, action);
      snackbars.show(DONE[action](nameOf(next.user), next));
      // A new relationship can open or close the cards: everything about this person is stale.
      forget('/api/friends');
      forget(profilePath(isu));
      forget(`/api/schedule/lessons/user/${isu}`);
      forget(`/api/sport/users/${isu}`);
      person.data = next;
      version += 1;
    } catch (error) {
      snackbars.error(errorText(error, FAILED[action]));
    } finally {
      pending = false;
    }
  }
</script>

<a class="m3-btn text back" href={href('/friends')}>
  <Icon name="arrow_back" size={18} />
  Друзья
</a>

{#if person.data}
  {@const user = person.data.user}
  {@const name = nameOf(user)}
  {@const relationship = person.data.relationship}
  <header class="hero">
    <Avatar {name} src={user.pictureUrl} size={88} />
    <div class="who">
      <h1 class="m3-headline-medium">{name}</h1>
      {#each user.groups as group (group.name)}
        <p class="m3-muted">{groupLine(group)}</p>
      {/each}
      <div class="relation">
        {#if self}
          <span class="m3-pill neutral">Это вы</span>
          <a class="m3-btn outlined small" href={href('/me')}>Ваш профиль</a>
        {:else if relationship === 'FRIENDS'}
          <span class="m3-pill ok"><Icon name="check" size={16} />В друзьях</span>
          <button
            class="m3-btn outlined small"
            disabled={pending}
            onclick={() => (removing = true)}
          >
            Удалить из друзей
          </button>
        {:else if relationship === 'INCOMING'}
          <span class="m3-pill primary">Хочет добавить вас в друзья</span>
          <button class="m3-btn tonal small" disabled={pending} onclick={() => change('accept')}>
            Принять
          </button>
          <button class="m3-btn text small" disabled={pending} onclick={() => change('reject')}>
            Отклонить
          </button>
        {:else if relationship === 'OUTGOING'}
          <span class="m3-pill neutral">Заявка отправлена</span>
          <button class="m3-btn outlined small" disabled={pending} onclick={() => change('cancel')}>
            Отменить заявку
          </button>
        {:else}
          <button class="m3-btn tonal small" disabled={pending} onclick={() => change('request')}>
            <Icon name="person_add" />
            Добавить в друзья
          </button>
        {/if}
      </div>
    </div>
  </header>

  {#key `${version}:${can(user, 'canViewSchedule')}:${can(user, 'canViewSport')}:${can(user, 'canViewFriends')}`}
    <div class="grid">
      <ScheduleCard {isu} allowed={can(user, 'canViewSchedule')} />
      <div class="stack">
        <SportCard {isu} allowed={can(user, 'canViewSport')} />
        <FriendsCard {isu} allowed={can(user, 'canViewFriends')} />
      </div>
    </div>
  {/key}

  {#if removing}
    <ConfirmDialog
      title="Удалить из друзей?"
      text={`${name} перестанет видеть то, что вы открыли только друзьям.`}
      confirmLabel="Удалить"
      danger
      onconfirm={() => change('remove')}
      oncancel={() => (removing = false)}
    />
  {/if}
{:else if missing}
  <section class="m3-card">
    <EmptyState
      icon="person_off"
      title="Пользователь не найден"
      text="Этого человека нет в ITMO.Widgets."
    />
  </section>
{:else if person.error}
  <section class="m3-card">
    <LoadError
      error={person.error}
      title="Не удалось загрузить профиль"
      onretry={() => person.load()}
    />
  </section>
{:else}
  <div class="waiting"><LoadingIndicator label="Загружаем профиль" /></div>
{/if}

<style>
  .back {
    margin: -8px 0 8px -12px;
  }
  .hero {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px 24px;
    margin-bottom: 24px;
  }
  .who {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  h1 {
    margin: 0;
    overflow-wrap: break-word;
  }
  .who p {
    margin: 0;
  }
  .relation {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    align-items: start;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .stack {
    display: grid;
    gap: 16px;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 40vh;
  }
  /* On a phone the name gets the full width under the avatar. */
  @media (max-width: 520px) {
    .hero {
      flex-direction: column;
      align-items: flex-start;
    }
    .who {
      align-self: stretch;
    }
  }
</style>
