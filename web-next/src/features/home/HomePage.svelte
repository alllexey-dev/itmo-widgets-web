<script lang="ts">
  import { PageHeader } from '@alllexey/ui';
  import { displayName, hasAccess, session } from '../../lib/session.svelte';
  import AppCard from './AppCard.svelte';
  import AttentionCard from './AttentionCard.svelte';
  import AudiencesCard from './AudiencesCard.svelte';
  import QueuesCard from './QueuesCard.svelte';
  import RequestsCard from './RequestsCard.svelte';
  import WeekCard from './WeekCard.svelte';

  // Главная adapts by role: staff see "Требует внимания" first, the admin also "За 7 дней"; then the
  // student cards everybody has: friend requests, sport queues, audiences and the app.
  const user = $derived(session.user);
  const moderator = $derived(hasAccess(user, 'moderator'));
  const admin = $derived(hasAccess(user, 'admin'));
  const intro = $derived.by(() => {
    if (!user) return '';
    const group = user.groups[0];
    const where = group
      ? [group.name, group.course > 0 ? `${group.course} курс` : null, group.facultyShortName]
          .filter(Boolean)
          .join(', ')
      : null;
    return [displayName(user), where].filter(Boolean).join(' · ');
  });
</script>

<PageHeader title="Главная" text={intro} />

<div class="grid">
  {#if moderator}<AttentionCard />{/if}
  {#if admin}<WeekCard />{/if}
  <RequestsCard />
  <QueuesCard />
  <AudiencesCard />
  <AppCard />
</div>

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
</style>
