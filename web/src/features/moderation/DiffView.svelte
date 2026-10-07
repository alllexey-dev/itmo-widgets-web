<script lang="ts" module>
  export interface DiffRow {
    key: string;
    label: string;
    before: string;
    after: string;
    changed: boolean;
  }
</script>

<script lang="ts">
  // Two versions side by side; a changed row says so in words, not only in colour.
  let {
    caption,
    rows,
    beforeLabel,
    afterLabel,
  }: { caption: string; rows: DiffRow[]; beforeLabel: string; afterLabel: string } = $props();
</script>

<table class="diff">
  <caption class="mod-vh">{caption}</caption>
  <thead>
    <tr>
      <th scope="col" class="field-head"><span class="mod-vh">Поле</span></th>
      <th scope="col">{beforeLabel}</th>
      <th scope="col">{afterLabel}</th>
    </tr>
  </thead>
  <tbody>
    {#each rows as row (row.key)}
      <tr class:changed={row.changed}>
        <th scope="row" class="field">
          <span>{row.label}</span>
          {#if row.changed}<span class="m3-pill warn badge">изменено</span>{/if}
        </th>
        <td class="before" data-label={beforeLabel}>{row.before}</td>
        <td class="after" data-label={afterLabel}>{row.after}</td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .diff {
    position: relative;
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font: var(--md-body-medium);
  }
  th,
  td {
    padding: 8px 12px;
    text-align: start;
    vertical-align: top;
    overflow-wrap: anywhere;
  }
  thead th {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .field-head {
    width: 132px;
  }
  .field {
    font: var(--md-label-large);
    color: var(--md-on-surface-variant);
  }
  .badge {
    display: flex;
    width: fit-content;
    margin-top: 4px;
  }
  tbody th,
  tbody td {
    border-top: 1px solid var(--md-outline-variant);
  }
  .changed .before {
    background: color-mix(in srgb, var(--md-error-container) 40%, transparent);
    text-decoration: line-through;
    text-decoration-color: color-mix(in srgb, var(--md-on-error-container) 50%, transparent);
  }
  .changed .after {
    background: color-mix(in srgb, var(--md-success-container) 45%, transparent);
  }
  @media (max-width: 600px) {
    thead {
      display: none;
    }
    tr,
    th,
    td {
      display: block;
    }
    tbody tr {
      padding: 8px 0;
      border-top: 1px solid var(--md-outline-variant);
    }
    tbody th,
    tbody td {
      border-top: 0;
      border-radius: var(--md-shape-sm);
    }
    td::before {
      content: attr(data-label) ': ';
      font-weight: 500;
      color: var(--md-on-surface-variant);
    }
  }
</style>
