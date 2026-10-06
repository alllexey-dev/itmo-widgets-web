<script lang="ts">
  import { EmptyState, PageHeader } from '@alllexey/ui';

  // A rail section that is not built yet.
  let { title, text }: { title: string; text: string } = $props();
</script>

<PageHeader {title} />
<section class="m3-card">
  <EmptyState icon="construction" title="Раздел скоро появится" {text} />
</section>
