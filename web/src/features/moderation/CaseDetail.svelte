<script lang="ts">
  import { ConfirmDialog, EmptyState, Icon, LoadingIndicator, snackbars } from '@alllexey/ui';
  import { ApiError } from '../../api/client';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { Resource } from '../../lib/resource.svelte';
  import { hasAccess, session } from '../../lib/session.svelte';
  import { caseKey, decide, fetchCase } from './api';
  import AuthorSection from './AuthorSection.svelte';
  import CaseChanges from './CaseChanges.svelte';
  import CaseHistory from './CaseHistory.svelte';
  import { formatDateTime, formatRelative } from './format';
  import { CASE_STATUSES, doneText, periodLabel, REASONS, TARGET_TEXTS } from './labels';
  import LinkPreview from './LinkPreview.svelte';
  import RejectDialog from './RejectDialog.svelte';
  import RestrictDialog from './RestrictDialog.svelte';
  import ReviewPreview from './ReviewPreview.svelte';
  import { shortcuts } from './shortcuts.svelte';
  import type { CaseTarget, DecisionRequest, ModerationAction, ModerationCase } from './types';

  // One case; the page mounts a new instance per case, so dialogs and a pending decision never leak
  // into the next one. `onback` is given on phones, where the detail replaces the list.
  let {
    caseId,
    onback,
    ondecided,
  }: {
    caseId: string;
    onback?: () => void;
    ondecided: (updated: ModerationCase) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const detail = new Resource(caseKey(caseId), () => fetchCase(caseId));
  void detail.load();

  let dialog = $state<'reject' | 'restrict' | 'hideAll' | null>(null);
  let pending = $state<ModerationAction | null>(null);

  const data = $derived(detail.data);
  const target = $derived(data?.target ?? null);
  const texts = $derived(data ? TARGET_TEXTS[data.targetType] : null);
  const open = $derived(data?.status === 'OPEN' && target !== null);
  const hidden = $derived(isHidden(target));
  const canOpenProfile = $derived(hasAccess(session.user, 'admin'));
  const missing = $derived(detail.error instanceof ApiError && detail.error.code === 'not_found');

  function isHidden(value: CaseTarget | null): boolean {
    if (!value) return false;
    return value.targetType === 'SUBJECT_RESOURCE'
      ? value.link.status === 'HIDDEN'
      : value.review.hidden;
  }

  function titleOf(value: CaseTarget): string {
    if (value.targetType === 'SUBJECT_RESOURCE') return value.link.subjectName;
    return `${value.review.teacherName ?? 'Преподаватель'} · ИСУ ${value.review.teacherIsu}`;
  }

  async function submit(request: DecisionRequest) {
    if (pending || !data) return;
    pending = request.action;
    try {
      const updated = await decide(data.id, request);
      detail.data = updated;
      dialog = null;
      snackbars.show(doneText(request.action, data.targetType));
      ondecided(updated);
    } catch (error) {
      snackbars.error(
        errorText(error, 'Не удалось сохранить решение', {
          business_rule_violation: 'Заявка уже закрыта',
          invalid_request_data: 'Проверьте причину и срок',
        }),
      );
      // A case closed by someone else: show its current state.
      void detail.load();
    } finally {
      pending = null;
    }
  }

  shortcuts(() =>
    open && !pending && !dialog
      ? { KeyA: () => void submit({ action: 'APPROVE' }), KeyR: () => (dialog = 'reject') }
      : {},
  );
</script>

<div class="detail">
  {#if !data}
    {#if onback}
      <button class="m3-icon-btn back" aria-label="К списку" onclick={onback}>
        <Icon name="arrow_back" />
      </button>
    {/if}
    {#if missing}
      <EmptyState icon="search_off" title="Заявка не найдена" text="Возможно, её уже удалили." />
    {:else if detail.error}
      <LoadError
        error={detail.error}
        title="Не удалось загрузить заявку"
        onretry={() => detail.load()}
      />
    {:else}
      <div class="waiting"><LoadingIndicator label="Загружаем заявку" /></div>
    {/if}
  {:else}
    {@const reason = REASONS[data.reason]}
    {@const status = CASE_STATUSES[data.status]}
    <article class="case" aria-labelledby="case-title">
      <header class="head">
        {#if onback}
          <button class="m3-icon-btn back" aria-label="К списку" onclick={onback}>
            <Icon name="arrow_back" />
          </button>
        {/if}
        <div class="head-text">
          <div class="badges">
            <span class="m3-pill {reason.tone}">{reason.label}</span>
            {#if data.status !== 'OPEN'}<span class="m3-pill {status.tone}">{status.label}</span
              >{/if}
            <span class="m3-body-small m3-muted" title={formatDateTime(data.openedAt)}>
              открыта {formatRelative(data.openedAt)}
            </span>
          </div>
          <h2 id="case-title" class="title">{target ? titleOf(target) : texts?.deleted}</h2>
          {#if target?.targetType === 'SUBJECT_RESOURCE'}
            <p class="m3-muted period">{periodLabel(target.link.periodKey)}</p>
          {/if}
        </div>
      </header>

      {#if target && texts}
        {#if open}
          <div class="actions" role="group" aria-label="Действия">
            <button
              class="m3-btn"
              disabled={pending !== null}
              aria-keyshortcuts="A"
              onclick={() => submit({ action: 'APPROVE' })}
            >
              <Icon name="check" />Одобрить
            </button>
            <button
              class="m3-btn danger-tonal"
              disabled={pending !== null}
              aria-keyshortcuts="R"
              onclick={() => (dialog = 'reject')}
            >
              <Icon name="close" />Отклонить
            </button>
            {#if hidden}
              <button
                class="m3-btn text"
                disabled={pending !== null}
                onclick={() => submit({ action: 'RESTORE' })}
              >
                <Icon name="visibility" />Вернуть
              </button>
            {:else}
              <button
                class="m3-btn text"
                disabled={pending !== null}
                onclick={() => submit({ action: 'HIDE' })}
              >
                <Icon name="visibility_off" />Скрыть
              </button>
            {/if}
            {#if target.reports.length > 0}
              <button
                class="m3-btn text"
                disabled={pending !== null}
                onclick={() => submit({ action: 'DISMISS' })}
              >
                <Icon name="flag" />Отклонить жалобы
              </button>
            {/if}
            <button
              class="m3-btn text"
              disabled={pending !== null}
              onclick={() => (dialog = 'restrict')}
            >
              <Icon name="block" />Ограничить
            </button>
            <button
              class="m3-btn text error"
              disabled={pending !== null}
              onclick={() => (dialog = 'hideAll')}
            >
              <Icon name="hide_source" />Скрыть всё у автора
            </button>
          </div>
        {:else if hidden}
          <div class="actions" role="group" aria-label="Действия">
            <button
              class="m3-btn tonal"
              disabled={pending !== null}
              onclick={() => submit({ action: 'RESTORE' })}
            >
              <Icon name="visibility" />Вернуть
            </button>
          </div>
        {/if}

        {#if target.targetType === 'SUBJECT_RESOURCE'}
          <LinkPreview {target} />
        {:else}
          <ReviewPreview {target} />
        {/if}
        <CaseChanges {target} />
        <AuthorSection author={target.author} history={target.submitterHistory} {canOpenProfile} />
      {:else if texts}
        <p class="mod-note">{texts.deletedNote}</p>
      {/if}
      <CaseHistory reports={target?.reports ?? null} decisions={data.decisions} />
    </article>

    {#if target && texts && dialog === 'reject'}
      <RejectDialog
        title={texts.rejectTitle}
        presets={texts.rejectPresets}
        saving={pending !== null}
        onsubmit={submit}
        onclose={() => (dialog = null)}
      />
    {:else if target && texts && dialog === 'restrict'}
      <RestrictDialog
        authorName={target.author.name}
        defaultCapability={texts.restriction}
        saving={pending !== null}
        onsubmit={submit}
        onclose={() => (dialog = null)}
      />
    {:else if target && texts && dialog === 'hideAll'}
      <ConfirmDialog
        title={texts.hideAllTitle}
        text={texts.hideAllText(target.author.name)}
        confirmLabel="Скрыть всё"
        danger
        requireText={target.author.name}
        onconfirm={() => submit({ action: 'HIDE_ALL_BY_USER' })}
        oncancel={() => !pending && (dialog = null)}
      />
    {/if}
  {/if}
</div>

<style>
  .detail {
    display: grid;
    gap: 20px;
  }
  .waiting {
    display: grid;
    place-items: center;
    min-height: 240px;
  }
  .case {
    display: grid;
    gap: 24px;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .back {
    flex: none;
    margin: -4px 0 0 -8px;
  }
  .head-text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 8px;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .title {
    font: var(--md-headline-small);
    overflow-wrap: anywhere;
  }
  .period {
    margin: -4px 0 0;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .m3-btn.error {
    color: var(--md-error);
  }
</style>
