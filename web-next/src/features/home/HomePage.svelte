<script lang="ts">
  import { PageHeader, Shape } from '@alllexey/ui';
  import { displayName, hasAccess, roleLabel, session } from '../../lib/session.svelte';
  import AttentionCard from './AttentionCard.svelte';
  import WeekCard from './WeekCard.svelte';

  // Главная adapts by role: staff see "Требует внимания" first, the admin also "За 7 дней".
  // The student cards (friend requests, sport queues, audiences, the app) come in WV-05 after them.
  const user = $derived(session.user);
  const moderator = $derived(hasAccess(user, 'moderator'));
  const admin = $derived(hasAccess(user, 'admin'));
  const intro = $derived(
    admin
      ? 'Что требует внимания и неделя в цифрах'
      : moderator
        ? 'Очередь модерации и ваш профиль'
        : 'Ваш профиль в ITMO.Widgets',
  );
</script>

<PageHeader title="Главная" text={intro} />

<div class="grid">
  {#if moderator}<AttentionCard />{/if}
  {#if admin}<WeekCard />{/if}
  {#if user}
    {@const name = displayName(user)}
    {@const role = roleLabel(user)}
    <section class="m3-card profile" aria-labelledby="home-name">
      <Shape
        shape="cookie9"
        size={80}
        color="var(--md-tertiary-container)"
        fg="var(--md-on-tertiary-container)"
      >
        <span class="initial" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      </Shape>
      <div class="text">
        <h2 id="home-name" class="m3-title-large">{name}</h2>
        <p class="m3-muted">ИСУ {user.isu}</p>
        {#each user.groups as group (group.name)}
          <p class="m3-muted">
            {[group.name, group.course > 0 ? `${group.course} курс` : null, group.facultyShortName]
              .filter(Boolean)
              .join(' · ')}
          </p>
        {/each}
        {#if role}<span class="m3-pill neutral role">{role}</span>{/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  @media (min-width: 900px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  .profile {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  .text {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .text p {
    margin: 0;
  }
  h2 {
    margin: 0;
  }
  .initial {
    font: var(--md-headline-medium);
  }
  .role {
    justify-self: start;
    margin-top: 8px;
  }
  @media (max-width: 520px) {
    .profile {
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
    }
  }
</style>
