<script lang="ts">
  import { Avatar, forget, Icon, Loadable, Resource, snackbars } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { href } from '../../lib/router.svelte';
  import { answerRequest, incomingRequests, nameOf } from './student';
  import type { UserProfile } from './types';

  // Incoming friend requests answered right here; the rest is on Друзья.
  const SHOWN = 3;
  const requests = new Resource(incomingRequests.key, incomingRequests.fetch);
  void requests.load();
  const shown = $derived(requests.data?.slice(0, SHOWN) ?? []);
  let pending = $state<number | null>(null);

  async function answer(profile: UserProfile, accept: boolean) {
    const name = nameOf(profile.user);
    pending = profile.user.isu;
    try {
      await answerRequest(profile.user.isu, accept);
      snackbars.show(accept ? `${name} теперь в друзьях` : 'Заявка отклонена');
      forget('/api/friends');
      forget(`/api/users/${profile.user.isu}`);
      await requests.load();
    } catch (error) {
      snackbars.error(
        errorText(error, accept ? 'Не удалось принять заявку' : 'Не удалось отклонить заявку'),
      );
    } finally {
      pending = null;
    }
  }
</script>

<section class="m3-card" aria-labelledby="home-requests">
  <div class="head">
    <h2 id="home-requests" class="m3-section-title">
      Заявки в друзья
      {#if requests.data && requests.data.length > 0}
        <span class="count m3-num">{requests.data.length}</span>
      {/if}
    </h2>
    <a class="m3-btn text small" href={href('/friends?tab=incoming')} aria-label="Все заявки">Все</a
    >
  </div>
  <Loadable resource={requests} loadingLabel="Загружаем заявки">
    {#if shown.length > 0}
      <ul class="m3-segmented" aria-label="Заявки в друзья">
        {#each shown as profile (profile.user.isu)}
          {@const name = nameOf(profile.user)}
          {@const group = profile.user.groups[0]}
          <li class="m3-list-item request">
            <span class="lead"
              ><Avatar {name} src={profile.user.pictureUrl ?? ''} decorative /></span
            >
            <span class="main">
              <a class="headline person" href={href(`/u/${profile.user.isu}`)}>{name}</a>
              {#if group}<span class="support">{group.name} · {group.facultyShortName}</span>{/if}
            </span>
            <span class="trail actions">
              <button
                class="m3-btn tonal small"
                disabled={pending === profile.user.isu}
                aria-label="Принять заявку: {name}"
                onclick={() => answer(profile, true)}>Принять</button
              >
              <button
                class="m3-icon-btn"
                disabled={pending === profile.user.isu}
                aria-label="Отклонить заявку: {name}"
                title="Отклонить"
                onclick={() => answer(profile, false)}
              >
                <Icon name="close" />
              </button>
            </span>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="m3-muted">Новых заявок нет.</p>
    {/if}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить заявки" onretry={() => requests.load()} />
    {/snippet}
  </Loadable>
</section>

<style>
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }
  .head h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
  }
  .count {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  p {
    margin: 0;
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
