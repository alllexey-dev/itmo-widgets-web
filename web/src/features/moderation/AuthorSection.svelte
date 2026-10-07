<script lang="ts">
  import { Icon } from '@alllexey/ui';
  import { href } from '../../lib/router.svelte';
  import Avatar from './Avatar.svelte';
  import { formatDate } from './format';
  import { CAPABILITIES } from './labels';
  import type { AdminUserSummary, SubmitterHistory } from './types';

  // Moderators see the author even of an anonymous review; the profile link is for administrators.
  let {
    author,
    history,
    canOpenProfile,
  }: { author: AdminUserSummary; history: SubmitterHistory; canOpenProfile: boolean } = $props();

  const group = $derived.by(() => {
    const first = author.groups[0];
    if (!first) return null;
    return [first.name, first.course > 0 ? `${first.course} курс` : null, first.facultyShortName]
      .filter(Boolean)
      .join(' · ');
  });
</script>

<section class="mod-section" aria-labelledby="case-author">
  <h3 id="case-author">Автор</h3>
  <div class="who">
    <Avatar name={author.name} src={author.pictureUrl} size={48} />
    <div class="text">
      <span class="name">{author.name}</span>
      <span class="m3-muted">ИСУ {author.isu}{group ? ` · ${group}` : ''}</span>
    </div>
    {#if canOpenProfile}
      <a class="m3-btn text small" href={href(`/admin/users/${author.isu}`)}>Профиль</a>
    {/if}
  </div>
  <dl class="mod-facts">
    <div>
      <dt>Одобрено</dt>
      <dd class="m3-num">{history.approved}</dd>
    </div>
    <div>
      <dt>Отклонено</dt>
      <dd class="m3-num">{history.rejected}</dd>
    </div>
    <div>
      <dt>Жалобы отклонены</dt>
      <dd class="m3-num">{history.dismissedReports}</dd>
    </div>
  </dl>
  {#if history.activeRestrictions.length > 0}
    <ul class="restrictions" aria-label="Действующие ограничения">
      {#each history.activeRestrictions as restriction (restriction.id)}
        <li>
          <Icon name="block" size={18} />
          <span>
            <strong>{CAPABILITIES[restriction.capability]}</strong> ·
            {restriction.expiresAt ? `до ${formatDate(restriction.expiresAt)}` : 'бессрочно'}
            {#if restriction.reason}<span class="m3-muted"> — {restriction.reason}</span>{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .who {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .name {
    font: var(--md-title-small);
    overflow-wrap: anywhere;
  }
  .restrictions {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .restrictions li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--md-error);
  }
  .restrictions li > span {
    color: var(--md-on-surface);
  }
</style>
