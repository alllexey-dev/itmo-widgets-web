<script lang="ts">
  import { PageHeader, Shape } from '@alllexey/ui';
  import { displayName, roleLabel, session } from '../../lib/session.svelte';

  // Placeholder until WV-03 and WV-05 bring the attention card and the student cards.
  const user = $derived(session.user);
</script>

<PageHeader title="Главная" text="Ваш профиль в ITMO.Widgets" />

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

<style>
  .profile {
    display: flex;
    align-items: center;
    gap: 24px;
    max-width: 640px;
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
