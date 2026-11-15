import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Button } from '@astryxdesign/core/Button';
import { HStack } from '@astryxdesign/core/Stack';
import { Switch } from '@astryxdesign/core/Switch';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { useState, type FormEvent } from 'react';
import { useApiMutation, useApiQuery, type Resource } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { AUDIT_PREFIX, MODERATION_PREFIX, saveSettings, SETTINGS_PATH } from './api';
import { POLICIES, POLICY_NAMES, SUBMISSION_LABELS } from './labels';
import type { ModerationPolicy, ModerationSettings, PolicyKey } from './types';

/**
 * Модерация: one policy for links and one for reviews, side by side. A save sends both policies, the
 * other one as the server has it.
 */
export function ModerationTab() {
  const settings = useApiQuery<ModerationSettings>(SETTINGS_PATH);
  return (
    <div className="system-columns">
      {POLICIES.map((key) => (
        <Panel
          body="content"
          key={key}
          title={POLICY_NAMES[key]}
          hint={
            key === 'SUBJECT_RESOURCE' ? 'Ссылки на материалы предметов' : 'Отзывы о преподавателях'
          }
        >
          <Policy policy={key} settings={settings} />
        </Panel>
      ))}
    </div>
  );
}

function Policy({
  policy,
  settings,
}: {
  policy: PolicyKey;
  settings: Resource<ModerationSettings>;
}) {
  return (
    <Loadable
      resource={settings}
      label="Загружаем правила"
      errorTitle="Не удалось загрузить правила"
      isCompact
    >
      {(data) => {
        const saved = data.policies[policy];
        if (!saved) return <Text color="secondary">Сервер не прислал эти правила</Text>;
        return (
          <div className="system-form">
            {policy === 'SUBJECT_RESOURCE' ? (
              <Premoderation settings={data} />
            ) : (
              <Text type="supporting" color="secondary">
                Отзывы всегда проходят проверку перед публикацией
              </Text>
            )}
            {/* The thresholds start over when the saved thresholds change, not on the switch. */}
            <Limits
              key={[
                saved.reportThreshold,
                saved.voteThreshold,
                saved.dailySubmissionLimit,
                saved.dailyReportLimit,
              ].join(':')}
              policy={policy}
              settings={data}
              saved={saved}
            />
          </div>
        );
      }}
    </Loadable>
  );
}

function useSaveSettings(done: string | ((saved: ModerationSettings) => string), failed: string) {
  return useApiMutation({
    run: saveSettings,
    forgets: [MODERATION_PREFIX, AUDIT_PREFIX],
    done,
    failed,
    errors: { invalid_request_data: 'Проверьте пороги', invalid_request: 'Проверьте пороги' },
  });
}

/** Turning link premoderation off publishes the waiting links at once, so it asks first. */
function Premoderation({ settings }: { settings: ModerationSettings }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const links = settings.policies.SUBJECT_RESOURCE;
  const save = useSaveSettings(
    (saved) =>
      saved.policies.SUBJECT_RESOURCE?.premoderation
        ? 'Премодерация включена'
        : 'Премодерация выключена',
    'Не удалось изменить премодерацию',
  );
  if (!links) return null;

  const apply = (premoderation: boolean) =>
    save.mutate({
      policies: { ...settings.policies, SUBJECT_RESOURCE: { ...links, premoderation } },
    });

  return (
    <>
      <Switch
        label="Премодерация ссылок"
        description="Новые ссылки видны всем после проверки"
        labelPosition="start"
        labelSpacing="spread"
        value={links.premoderation}
        isLoading={save.isPending}
        onChange={(isOn) => {
          if (isOn) apply(true);
          else setIsConfirming(true);
        }}
      />
      <AlertDialog
        isOpen={isConfirming}
        onOpenChange={setIsConfirming}
        title="Выключить премодерацию?"
        description="Все ссылки, которые ждут проверки, сразу станут видны всем, кроме ваших собственных: их одобрит другой модератор. Новые ссылки будут публиковаться без проверки."
        actionLabel="Выключить"
        cancelLabel="Отмена"
        actionVariant="destructive"
        onAction={() => {
          setIsConfirming(false);
          apply(false);
        }}
      />
    </>
  );
}

type Limit = Exclude<keyof ModerationPolicy, 'premoderation'>;

interface LimitField {
  key: Limit;
  label: (policy: PolicyKey) => string;
  hint: string;
  isValid: (value: number) => boolean;
  error: string;
}

const atLeastOne = { isValid: (value: number) => value >= 1, error: 'Не меньше 1' };

const FIELDS: readonly LimitField[] = [
  {
    key: 'reportThreshold',
    label: () => 'Жалоб до проверки',
    hint: 'Разных авторов жалоб',
    ...atLeastOne,
  },
  {
    key: 'voteThreshold',
    label: () => 'Рейтинг для проверки',
    hint: 'Отрицательное число',
    isValid: (value) => value <= -1,
    error: 'Не больше −1',
  },
  {
    key: 'dailySubmissionLimit',
    label: (policy) => SUBMISSION_LABELS[policy],
    hint: 'На одного автора',
    ...atLeastOne,
  },
  {
    key: 'dailyReportLimit',
    label: () => 'Жалоб в сутки',
    hint: 'От одного человека',
    ...atLeastOne,
  },
];

/** A whole number, with the typographic minus accepted too. */
const parse = (text: string) =>
  /^\s*[-−]?\d+\s*$/.test(text) ? Number(text.replace('−', '-')) : NaN;

function Limits({
  policy,
  settings,
  saved,
}: {
  policy: PolicyKey;
  settings: ModerationSettings;
  saved: ModerationPolicy;
}) {
  const [values, setValues] = useState<Record<Limit, string>>({
    reportThreshold: String(saved.reportThreshold),
    voteThreshold: String(saved.voteThreshold),
    dailySubmissionLimit: String(saved.dailySubmissionLimit),
    dailyReportLimit: String(saved.dailyReportLimit),
  });
  const save = useSaveSettings('Правила сохранены', 'Не удалось сохранить правила');

  const errorOf = (field: LimitField) => {
    const value = parse(values[field.key]);
    return Number.isInteger(value) && field.isValid(value) ? undefined : field.error;
  };
  const isValid = FIELDS.every((field) => !errorOf(field));
  const isDirty = FIELDS.some(({ key }) => parse(values[key]) !== saved[key]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!isDirty || !isValid || save.isPending) return;
    const next: ModerationPolicy = {
      ...saved,
      reportThreshold: parse(values.reportThreshold),
      voteThreshold: parse(values.voteThreshold),
      dailySubmissionLimit: parse(values.dailySubmissionLimit),
      dailyReportLimit: parse(values.dailyReportLimit),
    };
    save.mutate({ policies: { ...settings.policies, [policy]: next } });
  }

  return (
    <form className="system-form" onSubmit={submit} noValidate>
      <div className="system-fields">
        {FIELDS.map((field) => {
          const error = errorOf(field);
          return (
            <TextInput
              key={field.key}
              label={field.label(policy)}
              description={field.hint}
              value={values[field.key]}
              onChange={(value) => setValues({ ...values, [field.key]: value })}
              status={error ? { type: 'error', message: error } : undefined}
              inputMode="numeric"
              autoComplete="off"
              hasSpellCheck={false}
            />
          );
        })}
      </div>
      <HStack gap={2}>
        <Button
          label="Сохранить"
          variant="primary"
          type="submit"
          isDisabled={!isDirty}
          isLoading={save.isPending}
        />
      </HStack>
    </form>
  );
}
