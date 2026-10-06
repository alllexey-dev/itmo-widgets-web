<script lang="ts">
  import { EmptyState } from '@alllexey/ui';
  import { href } from './router.svelte';
</script>

<section class="m3-card">
  <EmptyState icon="search_off" title="Не найдено" text="Проверьте адрес или вернитесь на главную.">
    <a class="m3-btn tonal" href={href('/')}>На главную</a>
  </EmptyState>
</section>
