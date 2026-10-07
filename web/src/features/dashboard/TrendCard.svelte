<script lang="ts">
  import { EmptyState } from '@alllexey/ui';
  import Chart from '@alllexey/ui/chart';
  import { formatNumber } from '../../lib/format';
  import type { DashboardDay, DayMetric } from './types';

  // One series over the 30 Moscow days of the dashboard, on the package's uPlot chart.
  let { days, metric, title }: { days: readonly DashboardDay[]; metric: DayMetric; title: string } =
    $props();

  const total = $derived(days.reduce((sum, day) => sum + day[metric], 0));
  // Each day at Moscow midnight, in seconds as uPlot expects.
  const times = $derived(days.map((day) => Date.parse(`${day.date}T00:00:00+03:00`) / 1000));
  const values = $derived([days.map((day) => day[metric])]);
  const series = $derived([{ label: title, color: '--md-primary' }]);
</script>

<section class="m3-card trend" aria-label={title}>
  <h2 class="m3-title-medium">{title}</h2>
  <p class="m3-muted m3-num">{formatNumber(total)} за 30 дней</p>
  {#if total === 0}
    <EmptyState icon="monitoring" title="За 30 дней ничего" />
  {:else}
    <figure aria-label="{title} по дням, всего {formatNumber(total)}">
      <Chart {times} {series} {values} withDate format={(value) => formatNumber(value)} />
    </figure>
  {/if}
</section>

<style>
  .trend {
    min-width: 0;
  }
  h2 {
    margin: 0;
  }
  p {
    margin: 4px 0 12px;
  }
  figure {
    margin: 0;
    min-width: 0;
  }
</style>
