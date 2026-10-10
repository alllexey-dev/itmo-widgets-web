<script lang="ts">
  import { ButtonGroup, ConfirmDialog, Loadable, Resource, snackbars, Switch } from '@alllexey/ui';
  import { errorText } from '../../api/errors';
  import LoadError from '../../lib/LoadError.svelte';
  import { fetchSettings, saveSettings, SETTINGS_PATH } from './api';
  import PolicyLimits from './PolicyLimits.svelte';
  import type { ModerationPolicy, ModerationSettings, PolicyKey } from './types';

  // Links and reviews have one policy each. Review premoderation is always on and has no switch;
  // turning link premoderation off publishes the waiting links at once, so it asks first.
  const POLICIES = [
    { value: 'SUBJECT_RESOURCE', label: 'Ссылки' },
    { value: 'TEACHER_REVIEW', label: 'Отзывы' },
  ] satisfies { value: PolicyKey; label: string }[];
  const SUBMISSION_LABELS: Record<PolicyKey, string> = {
    SUBJECT_RESOURCE: 'Ссылок в сутки',
    TEACHER_REVIEW: 'Отзывов в сутки',
  };

  const settings = new Resource<ModerationSettings>(SETTINGS_PATH, fetchSettings);
  void settings.load();

  let policy = $state<PolicyKey>('SUBJECT_RESOURCE');
  let premoderation = $state(true);
  let confirming = $state(false);
  let switching = $state(false);

  const links = $derived(settings.data?.policies.SUBJECT_RESOURCE);
  $effect(() => {
    if (links) premoderation = links.premoderation;
  });

  /** The thresholds form starts over when the saved thresholds change, not on the switch. */
  const limitsKey = (saved: ModerationPolicy) =>
    [
      saved.reportThreshold,
      saved.voteThreshold,
      saved.dailySubmissionLimit,
      saved.dailyReportLimit,
    ].join(':');

  /** Saves one policy; the other one goes back as the server has it. */
  async function save(key: PolicyKey, next: ModerationPolicy): Promise<void> {
    const current = settings.data;
    if (!current) return;
    settings.data = await saveSettings({ policies: { ...current.policies, [key]: next } });
  }

  async function applyPremoderation(on: boolean) {
    if (!links) return;
    confirming = false;
    switching = true;
    try {
      await save('SUBJECT_RESOURCE', { ...links, premoderation: on });
      snackbars.show(on ? 'Премодерация включена' : 'Премодерация выключена');
    } catch (error) {
      premoderation = links.premoderation;
      snackbars.error(errorText(error, 'Не удалось изменить премодерацию'));
    } finally {
      switching = false;
    }
  }

  function toggle(on: boolean) {
    if (on) void applyPremoderation(true);
    else confirming = true;
  }

  function cancel() {
    confirming = false;
    premoderation = true;
  }
</script>

<section class="m3-card" aria-labelledby="system-rules">
  <header class="head">
    <h2 class="m3-section-title" id="system-rules">Правила модерации</h2>
    <ButtonGroup small label="Правила" options={POLICIES} bind:value={policy} />
  </header>
  <Loadable resource={settings} loadingLabel="Загружаем правила">
    {#snippet children(data)}
      {#each POLICIES as option (option.value)}
        {@const saved = data.policies[option.value]}
        <div class="policy" hidden={policy !== option.value}>
          {#if !saved}
            <p class="m3-muted">Сервер не прислал эти правила</p>
          {:else}
            {#if option.value === 'SUBJECT_RESOURCE'}
              <div class="switch">
                <span class="text">
                  <span class="m3-body-large">Премодерация ссылок</span>
                  <span class="m3-body-small m3-muted">Новые ссылки видны всем после проверки</span>
                </span>
                <Switch
                  label="Премодерация ссылок"
                  bind:checked={premoderation}
                  disabled={switching}
                  onchange={toggle}
                />
              </div>
            {:else}
              <p class="m3-body-small m3-muted always">
                Отзывы всегда проходят проверку перед публикацией
              </p>
            {/if}
            {#key limitsKey(saved)}
              <PolicyLimits
                {saved}
                submissionLabel={SUBMISSION_LABELS[option.value]}
                onsave={(next) => save(option.value, next)}
              />
            {/key}
          {/if}
        </div>
      {/each}
    {/snippet}
    {#snippet failed(error)}
      <LoadError {error} title="Не удалось загрузить правила" onretry={() => settings.load()} />
    {/snippet}
  </Loadable>
</section>

{#if confirming}
  <ConfirmDialog
    title="Выключить премодерацию?"
    text="Все ссылки, которые ждут проверки, сразу станут видны."
    confirmLabel="Выключить"
    danger
    onconfirm={() => applyPremoderation(false)}
    oncancel={cancel}
  />
{/if}

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 8px 16px;
    margin-bottom: 16px;
  }
  .head h2 {
    margin: 0;
  }
  .switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  .text {
    display: grid;
    gap: 2px;
  }
  .always {
    margin: 0 0 20px;
  }
</style>
