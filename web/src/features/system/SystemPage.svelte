<script lang="ts">
  import { PageHeader } from '@alllexey/ui';
  import { router } from '../../lib/router.svelte';
  import AppVersionCard from './AppVersionCard.svelte';
  import ClientVersionsCard from './ClientVersionsCard.svelte';
  import CredentialsCard from './CredentialsCard.svelte';
  import './icons';
  import ModerationRulesCard from './ModerationRulesCard.svelte';
  import SportCard from './SportCard.svelte';

  // Система; /admin/sport, the former sport page, opens it at the sport automation card.
  const atSport = router.route.name === 'adminSport';
</script>

<PageHeader
  title="Система"
  text="Версии приложения, ключи, автозапись на спорт и правила модерации"
/>

<div class="cards">
  <div class="wide"><ClientVersionsCard /></div>
  <AppVersionCard />
  <CredentialsCard />
  <SportCard focused={atSport} />
  <ModerationRulesCard />
</div>

<style>
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr));
    gap: 16px;
    align-items: start;
  }
  .cards > :global(*) {
    min-width: 0;
  }
  .wide {
    grid-column: 1 / -1;
  }
</style>
