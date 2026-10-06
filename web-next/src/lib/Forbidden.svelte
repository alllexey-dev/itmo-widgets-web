<script lang="ts">
  import { EmptyState } from '@alllexey/ui';
  import { href, type Access } from './router.svelte';

  // A section the user's roles do not open; no request is sent, the backend would answer 403 anyway.
  let { access }: { access: Access } = $props();
  const who = $derived(access === 'admin' ? 'администратору' : 'модераторам');
</script>

<section class="m3-card">
  <EmptyState icon="lock" title="Нет доступа" text="Этот раздел доступен только {who}.">
    <a class="m3-btn tonal" href={href('/')}>На главную</a>
  </EmptyState>
</section>
