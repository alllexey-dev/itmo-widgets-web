<script lang="ts">
  import { snackbars } from '@alllexey/ui';
  import { untrack } from 'svelte';
  import { errorText } from '../../api/errors';
  import TextField from './TextField.svelte';
  import type { ModerationPolicy } from './types';

  // The thresholds of one policy; the card remounts it when the saved policy changes.
  type Limit = Exclude<keyof ModerationPolicy, 'premoderation'>;
  let {
    saved,
    submissionLabel,
    onsave,
  }: {
    saved: ModerationPolicy;
    submissionLabel: string;
    onsave: (policy: ModerationPolicy) => Promise<unknown>;
  } = $props();

  const FIELDS: {
    key: Limit;
    label: string;
    hint: string;
    valid: (value: number) => boolean;
    error: string;
  }[] = [
    {
      key: 'reportThreshold',
      label: 'Жалоб до проверки',
      hint: 'Разных авторов жалоб',
      valid: (value) => value >= 1,
      error: 'Не меньше 1',
    },
    {
      key: 'voteThreshold',
      label: 'Рейтинг для проверки',
      hint: 'Отрицательное число',
      valid: (value) => value <= -1,
      error: 'Не больше −1',
    },
    {
      key: 'dailySubmissionLimit',
      label: untrack(() => submissionLabel),
      hint: 'На одного автора',
      valid: (value) => value >= 1,
      error: 'Не меньше 1',
    },
    {
      key: 'dailyReportLimit',
      label: 'Жалоб в сутки',
      hint: 'От одного человека',
      valid: (value) => value >= 1,
      error: 'Не меньше 1',
    },
  ];

  let values = $state(
    untrack(
      () =>
        Object.fromEntries(FIELDS.map(({ key }) => [key, String(saved[key])])) as Record<
          Limit,
          string
        >,
    ),
  );
  let saving = $state(false);

  const parse = (text: string) =>
    /^\s*[-−]?\d+\s*$/.test(text) ? Number(text.replace('−', '-')) : NaN;
  const errors = $derived(
    Object.fromEntries(
      FIELDS.map((field) => {
        const value = parse(values[field.key]);
        return [field.key, Number.isInteger(value) && field.valid(value) ? '' : field.error];
      }),
    ) as Record<Limit, string>,
  );
  const valid = $derived(Object.values(errors).every((error) => !error));
  const dirty = $derived(FIELDS.some(({ key }) => parse(values[key]) !== saved[key]));

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (!dirty || !valid || saving) return;
    saving = true;
    try {
      await onsave({
        ...saved,
        reportThreshold: parse(values.reportThreshold),
        voteThreshold: parse(values.voteThreshold),
        dailySubmissionLimit: parse(values.dailySubmissionLimit),
        dailyReportLimit: parse(values.dailyReportLimit),
      });
      snackbars.show('Правила сохранены');
    } catch (error) {
      snackbars.error(
        errorText(error, 'Не удалось сохранить правила', {
          invalid_request_data: 'Проверьте пороги',
          invalid_request: 'Проверьте пороги',
        }),
      );
    } finally {
      saving = false;
    }
  }
</script>

<form class="form" onsubmit={submit}>
  <div class="limits">
    {#each FIELDS as field (field.key)}
      <TextField
        label={field.label}
        inputmode="numeric"
        bind:value={values[field.key]}
        hint={field.hint}
        error={errors[field.key]}
      />
    {/each}
  </div>
  <div>
    <button class="m3-btn" type="submit" disabled={!dirty || saving}>Сохранить</button>
  </div>
</form>

<style>
  .form {
    display: grid;
    gap: 16px;
  }
  .limits {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 16px;
  }
</style>
