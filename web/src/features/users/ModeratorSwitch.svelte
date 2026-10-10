<script lang="ts">
  import { ConfirmDialog, snackbars } from '@alllexey/ui';
  import { api } from '../../api/client';
  import { errorText } from '../../api/errors';
  import type { Role } from '../../lib/session.svelte';

  // The moderator role behind a confirmation. An admin can do everything already, so the switch stays on
  // and locked for them. The backend answers with the roles afterwards.
  let {
    isu,
    name,
    roles,
    onchanged,
  }: { isu: number; name: string; roles: Role[]; onchanged: (roles: Role[]) => void } = $props();

  const admin = $derived(roles.includes('ADMIN'));
  const on = $derived(admin || roles.includes('MODERATOR'));
  let confirming = $state<boolean | null>(null);
  let saving = $state(false);

  function ask(event: MouseEvent) {
    // The switch changes only after the confirmation and the backend's answer.
    event.preventDefault();
    confirming = !on;
  }

  async function apply() {
    const grant = confirming;
    confirming = null;
    if (grant === null) return;
    saving = true;
    try {
      const path = `/api/admin/users/${isu}/roles/MODERATOR`;
      const next = grant ? await api.put<Role[]>(path) : await api.delete<Role[]>(path);
      onchanged(next);
      snackbars.show(grant ? `${name} теперь модератор` : 'Роль модератора снята');
    } catch (error) {
      snackbars.error(errorText(error, 'Не удалось изменить роль'));
    } finally {
      saving = false;
    }
  }
</script>

<div class="access">
  <div class="text">
    <span id="moderator-label" class="m3-title-small">Модератор</span>
    <span id="moderator-hint" class="m3-body-medium m3-muted">
      {admin ? 'Администратор уже может всё' : 'Решает заявки и ограничивает авторов'}
    </span>
  </div>
  <span class="m3-switch">
    <input
      type="checkbox"
      role="switch"
      aria-labelledby="moderator-label"
      aria-describedby="moderator-hint"
      checked={on}
      disabled={admin || saving}
      onclick={ask}
    />
    <span class="track"><span class="thumb"></span></span>
  </span>
</div>

{#if confirming !== null}
  <ConfirmDialog
    title={confirming ? 'Назначить модератором?' : 'Снять роль модератора?'}
    text={confirming
      ? `${name} сможет решать заявки и ограничивать авторов.`
      : `${name} больше не сможет модерировать ссылки и отзывы.`}
    confirmLabel={confirming ? 'Назначить' : 'Снять роль'}
    danger={!confirming}
    onconfirm={apply}
    oncancel={() => (confirming = null)}
  />
{/if}

<style>
  .access {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .text {
    display: grid;
    gap: 2px;
    min-width: 0;
  }
</style>
