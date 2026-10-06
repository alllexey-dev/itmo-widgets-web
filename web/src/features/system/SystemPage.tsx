import { useState } from 'react';
import { errorText } from '../../api/errors';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  ErrorState,
  formatDateTime,
  LoadingIndicator,
  PageHeader,
  Switch,
  Textarea,
  TextField,
  useSnackbars,
} from '../../ui';
import {
  useAppVersion,
  useModerationSettings,
  useSaveAppVersion,
  useSaveModerationSettings,
} from './api';
import { CredentialsCard } from './CredentialsCard';
import styles from './SystemPages.module.css';
import {
  LINK_POLICY,
  REVIEW_POLICY,
  type AppVersion,
  type ModerationPolicy,
  type ModerationSettings,
} from './types';
import { compareVersions, isVersion, NOTE_LIMIT } from './version';

export function SystemPage() {
  return (
    <>
      <PageHeader title="Система" description="Версия приложения, модерация и учётные данные" />
      <div className={styles.cards}>
        <AppVersionCard />
        <ModerationSettingsCard
          policy={LINK_POLICY}
          title="Модерация ссылок"
          subtitle="Премодерация и пороги для ссылок предметов"
          submissionLabel="Ссылок в сутки"
          premoderationEditable
        />
        <ModerationSettingsCard
          policy={REVIEW_POLICY}
          title="Модерация отзывов"
          subtitle="Пороги для отзывов о преподавателях"
          submissionLabel="Отзывов в сутки"
          premoderationEditable={false}
        />
        <CredentialsCard />
      </div>
    </>
  );
}

function CardLoading({ label }: { label: string }) {
  return <LoadingIndicator compact label={label} />;
}

function AppVersionCard() {
  const version = useAppVersion();
  return (
    <Card as="section" aria-label="Версия приложения">
      <CardHeader
        title="Версия приложения"
        subtitle="Приложение предлагает обновиться до последней и требует минимальную"
      />
      {version.isPending ? (
        <CardLoading label="Загружаем версию" />
      ) : version.isError ? (
        <ErrorState
          compact
          title="Не удалось загрузить версию"
          description={errorText(version.error, 'Попробуйте ещё раз.')}
          onRetry={() => void version.refetch()}
          retrying={version.isFetching}
        />
      ) : (
        <AppVersionForm key={version.data.updatedAt ?? 'env'} saved={version.data} />
      )}
    </Card>
  );
}

function versionError(value: string): string | undefined {
  if (!value.trim()) return 'Укажите версию';
  if (!isVersion(value)) return 'Например, 2.3 или 2.3.1-beta';
  return undefined;
}

function AppVersionForm({ saved }: { saved: AppVersion }) {
  const snackbars = useSnackbars();
  const save = useSaveAppVersion();
  const [latest, setLatest] = useState(saved.latest);
  const [minimum, setMinimum] = useState(saved.minimum);
  const [note, setNote] = useState(saved.note);

  const latestError = versionError(latest);
  const minimumError =
    versionError(minimum) ??
    (!latestError && compareVersions(minimum, latest) > 0 ? 'Не выше последней' : undefined);
  const noteError =
    note.trim().length > NOTE_LIMIT ? `Не больше ${NOTE_LIMIT} символов` : undefined;
  const dirty =
    latest.trim() !== saved.latest ||
    minimum.trim() !== saved.minimum ||
    note.trim() !== saved.note;
  const valid = !latestError && !minimumError && !noteError;

  const reset = () => {
    setLatest(saved.latest);
    setMinimum(saved.minimum);
    setNote(saved.note);
  };

  const submit = () => {
    save.mutate(
      { latest: latest.trim(), minimum: minimum.trim(), note: note.trim() },
      {
        onSuccess: () => snackbars.show('Версия сохранена'),
        onError: (error) =>
          snackbars.error(
            errorText(error, 'Не удалось сохранить версию', {
              invalid_request_data: 'Проверьте версии и заметку',
            }),
          ),
      },
    );
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && valid) submit();
      }}
    >
      <p className={styles.source}>
        <Badge tone={saved.overridden ? 'info' : 'neutral'}>
          {saved.overridden ? 'Из настроек' : 'По умолчанию сервера'}
        </Badge>
        {saved.updatedAt && <span>изменено {formatDateTime(saved.updatedAt)}</span>}
      </p>
      <div className={styles.formRow}>
        <TextField
          label="Последняя"
          value={latest}
          onChange={(event) => setLatest(event.target.value)}
          error={latestError}
          autoComplete="off"
        />
        <TextField
          label="Минимальная"
          value={minimum}
          onChange={(event) => setMinimum(event.target.value)}
          error={minimumError}
          autoComplete="off"
        />
      </div>
      <Textarea
        label="Заметка к обновлению"
        hint="Видна в приложении рядом с предложением обновиться"
        value={note}
        maxLength={NOTE_LIMIT}
        error={noteError}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className={styles.formActions}>
        {dirty && (
          <Button variant="text" onClick={reset} disabled={save.isPending}>
            Отменить
          </Button>
        )}
        <Button type="submit" loading={save.isPending} disabled={!dirty}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

interface PolicyOptions {
  /** The target type the policy is keyed by. */
  policy: string;
  submissionLabel: string;
  /** Reviews are always premoderated: the backend refuses to turn it off. */
  premoderationEditable: boolean;
}

function ModerationSettingsCard({
  title,
  subtitle,
  ...options
}: PolicyOptions & { title: string; subtitle: string }) {
  const settings = useModerationSettings();
  const saved = settings.data?.policies[options.policy];
  return (
    <Card as="section" aria-label={title}>
      <CardHeader title={title} subtitle={subtitle} />
      {settings.isPending ? (
        <CardLoading label="Загружаем правила модерации" />
      ) : settings.isError || !saved ? (
        <ErrorState
          compact
          title="Не удалось загрузить правила"
          description={errorText(settings.error, 'Попробуйте ещё раз.')}
          onRetry={() => void settings.refetch()}
          retrying={settings.isFetching}
        />
      ) : (
        <ModerationSettingsForm
          key={JSON.stringify(saved)}
          settings={settings.data}
          saved={saved}
          {...options}
        />
      )}
    </Card>
  );
}

interface LimitField {
  key: Exclude<keyof ModerationPolicy, 'premoderation'>;
  label: string;
  hint: string;
  valid: (value: number) => boolean;
  error: string;
}

const limitFields = (submissionLabel: string): LimitField[] => [
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
    label: submissionLabel,
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

function ModerationSettingsForm({
  settings,
  saved,
  policy,
  submissionLabel,
  premoderationEditable,
}: PolicyOptions & { settings: ModerationSettings; saved: ModerationPolicy }) {
  const fields = limitFields(submissionLabel);
  const snackbars = useSnackbars();
  const save = useSaveModerationSettings();
  const [premoderation, setPremoderation] = useState(saved.premoderation);
  const [limits, setLimits] = useState(() =>
    Object.fromEntries(fields.map(({ key }) => [key, String(saved[key])])),
  );
  const [confirming, setConfirming] = useState(false);

  const errors = Object.fromEntries(
    fields.map((field) => {
      const text = limits[field.key] ?? '';
      const value = Number(text);
      const ok = /^-?\d+$/.test(text.trim()) && field.valid(value);
      return [field.key, ok ? undefined : field.error];
    }),
  );
  const valid = Object.values(errors).every((error) => error === undefined);
  const next: ModerationPolicy = {
    premoderation,
    reportThreshold: Number(limits.reportThreshold),
    voteThreshold: Number(limits.voteThreshold),
    dailySubmissionLimit: Number(limits.dailySubmissionLimit),
    dailyReportLimit: Number(limits.dailyReportLimit),
  };
  const dirty =
    premoderation !== saved.premoderation || fields.some(({ key }) => next[key] !== saved[key]);

  const submit = () => {
    save.mutate(
      { policies: { ...settings.policies, [policy]: next } },
      {
        onSuccess: () => {
          setConfirming(false);
          snackbars.show('Правила сохранены');
        },
        onError: (error) =>
          snackbars.error(
            errorText(error, 'Не удалось сохранить правила', {
              invalid_request_data: 'Проверьте пороги',
            }),
          ),
      },
    );
  };

  const requestSave = () => {
    if (!dirty || !valid) return;
    if (saved.premoderation && !premoderation) setConfirming(true);
    else submit();
  };

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        requestSave();
      }}
    >
      {premoderationEditable && (
        <>
          <Switch
            label="Премодерация"
            description="Ссылки для всех видны только после проверки"
            checked={premoderation}
            danger={saved.premoderation && !premoderation}
            onChange={setPremoderation}
          />
          <hr className={styles.divider} />
        </>
      )}
      <div className={styles.limits}>
        {fields.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            hint={field.hint}
            inputMode="numeric"
            value={limits[field.key] ?? ''}
            error={errors[field.key]}
            onChange={(event) =>
              setLimits((current) => ({ ...current, [field.key]: event.target.value }))
            }
          />
        ))}
      </div>
      <div className={styles.formActions}>
        <Button type="submit" loading={save.isPending && !confirming} disabled={!dirty}>
          Сохранить
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        loading={save.isPending}
        title="Выключить премодерацию?"
        description="Все ссылки, которые ждут проверки, сразу станут видны."
        confirmLabel="Выключить"
        danger
      />
    </form>
  );
}
