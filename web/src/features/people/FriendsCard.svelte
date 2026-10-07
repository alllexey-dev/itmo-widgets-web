<script lang="ts">
  import { LoadingIndicator, LoadingOverlay } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { ApiError } from '../../api/client';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { href } from '../../lib/router.svelte';
  import { friendsOf, friendsPath } from './api';
  import Avatar from './Avatar.svelte';
  import { firstNameOf, nameOf } from './labels';

  // The person's accepted friends; each face opens that person.
  const SHOWN = 8;
  let { isu, allowed }: { isu: number; allowed: boolean } = $props();
  // The page remounts the card when the person or the capability changes.
  const owner = untrack(() => isu);

  const friends = new Resource(friendsPath(owner), () => friendsOf(owner));
  if (untrack(() => allowed)) void friends.load();

  const denied = $derived(
    !allowed || (friends.error instanceof ApiError && friends.error.isForbidden),
  );
  const shown = $derived(friends.data?.slice(0, SHOWN) ?? []);
  const more = $derived(Math.max(0, (friends.data?.length ?? 0) - SHOWN));
</script>

<section class="m3-card" aria-labelledby="person-friends">
  <h2 id="person-friends" class="m3-section-title">
    Друзья
    {#if !denied && friends.data}<span class="count m3-num">{friends.data.length}</span>{/if}
  </h2>
  {#if denied}
    <p class="m3-muted">Список друзей скрыт.</p>
  {:else if friends.data}
    <LoadingOverlay loading={friends.loading}>
      {#if friends.data.length === 0}
        <p class="m3-muted">Друзей пока нет.</p>
      {:else}
        <ul class="faces" aria-label="Друзья">
          {#each shown as friend (friend.user.isu)}
            <li>
              <a class="face" href={href(`/u/${friend.user.isu}`)} aria-label={nameOf(friend.user)}>
                <Avatar name={nameOf(friend.user)} src={friend.user.pictureUrl} size={48} />
                <span class="m3-body-small m3-clip" aria-hidden="true"
                  >{firstNameOf(friend.user)}</span
                >
              </a>
            </li>
          {/each}
        </ul>
        {#if more > 0}<p class="m3-body-small m3-muted more">И ещё {more}</p>{/if}
      {/if}
    </LoadingOverlay>
  {:else if friends.error}
    <LoadError
      error={friends.error}
      title="Не удалось загрузить друзей"
      onretry={() => friends.load()}
    />
  {:else}
    <div class="waiting"><LoadingIndicator label="Загружаем друзей" /></div>
  {/if}
</section>

<style>
  h2 {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .count {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  p {
    margin: 0;
  }
  .faces {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    min-height: 48px;
    padding: 8px 4px;
    border-radius: var(--md-shape-lg);
    color: inherit;
    text-decoration: none;
  }
  .face > span {
    max-width: 100%;
  }
  @media (hover: hover) {
    .face:hover {
      background: color-mix(in srgb, var(--md-on-surface) 8%, transparent);
    }
  }
  .face:focus-visible {
    outline: 3px solid var(--md-secondary);
    outline-offset: 2px;
  }
  .more {
    margin: 8px 4px 0;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 96px;
  }
</style>
