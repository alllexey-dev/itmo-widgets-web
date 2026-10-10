<script lang="ts">
  import { Avatar, Icon, LoadingIndicator, PageHeader, Resource, snackbars } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import { formatDate } from '../../lib/format';
  import LoadError from '../../lib/LoadError.svelte';
  import { displayName, roleLabel, session } from '../../lib/session.svelte';
  import { restrictions, RESTRICTIONS_PATH } from './api';
  import { groupLine, RESTRICTED } from './labels';
  import PrivacyCard from './PrivacyCard.svelte';

  // The signed-in user: who they are, who sees their data, a restriction in force and this sign-in.
  // Account deletion joins here with WV-07.
  const active = new Resource(RESTRICTIONS_PATH, restrictions);
  void active.load();

  const user = $derived(session.user);
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
</script>

{#if user}
  {@const name = displayName(user)}
  {@const role = roleLabel(user)}
  <PageHeader title="Профиль" text={`ИСУ ${user.isu}`} />

  <div class="grid">
    <div class="stack">
      <section class="m3-card identity" aria-labelledby="profile-name">
        <Avatar {name} src={user.pictureUrl ?? ''} size={72} decorative />
        <div class="who">
          <h2 id="profile-name" class="m3-title-large">{name}</h2>
          {#each user.groups as group (group.name)}
            <p class="m3-muted">{groupLine(group)}</p>
          {/each}
          {#if role}
            <span class="m3-pill neutral role"><Icon name="shield_person" size={16} />{role}</span>
          {/if}
        </div>
      </section>

      <PrivacyCard />

      {#if active.data && active.data.length > 0}
        <section class="m3-card warning" aria-labelledby="profile-restriction">
          <h2 id="profile-restriction" class="m3-section-title title">
            <Icon name="block" />
            {active.data.length > 1 ? 'Ограничения' : 'Ограничение'}
          </h2>
          {#each active.data as restriction (restriction.id)}
            <div class="restriction">
              <p class="m3-body-large">
                {RESTRICTED[restriction.capability]}
                {restriction.expiresAt ? `до ${formatDate(restriction.expiresAt)}` : 'без срока'}
              </p>
              <p class="m3-body-medium">Причина: «{restriction.reason}»</p>
            </div>
          {/each}
        </section>
      {:else if active.error}
        <section class="m3-card" aria-labelledby="profile-restriction">
          <h2 id="profile-restriction" class="m3-section-title">Ограничения</h2>
          <LoadError
            error={active.error}
            title="Не удалось проверить ограничения"
            onretry={() => active.load()}
          />
        </section>
      {/if}
    </div>

    <div class="stack">
      <section class="m3-card" aria-labelledby="profile-session">
        <h2 id="profile-session" class="m3-section-title">Этот вход</h2>
        <p class="m3-body-large">Вы вошли на сайт, подтвердив вход в приложении.</p>
        <p class="m3-body-medium m3-muted">
          Вход закончится после 14 дней без действий, а в любом случае — через 60 дней.
        </p>
        {#if role}
          <p class="m3-body-medium m3-muted">
            Для действий модератора и администратора вход нужно подтверждать раз в 12 часов.
          </p>
        {/if}
        <button class="m3-btn tonal out" disabled={leaving} onclick={logout}>
          <Icon name="logout" />
          Выйти
        </button>
      </section>
    </div>
  </div>
{:else}
  <div class="waiting"><LoadingIndicator size={56} /></div>
{/if}

<style>
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
  .identity {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .who {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .who h2 {
    margin: 0;
    overflow-wrap: break-word;
  }
  p {
    margin: 0;
  }
  .role {
    justify-self: start;
    margin-top: 4px;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .restriction {
    display: grid;
    gap: 4px;
  }
  .restriction + .restriction {
    margin-top: 12px;
  }
  .out {
    margin-top: 16px;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 40vh;
  }
</style>
