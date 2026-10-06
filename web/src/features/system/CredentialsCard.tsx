import { useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errors';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  ErrorState,
  formatDateTime,
  Table,
  TextField,
  useSnackbars,
  type TableColumn,
} from '../../ui';
import { useReplaceServiceCredential, useServiceCredentials } from './api';
import { CREDENTIAL_SOURCES, CREDENTIAL_STATUSES, CREDENTIALS } from './labels';
import styles from './SystemPages.module.css';
import type { ServiceCredential, ServiceCredentialKey } from './types';

const REPLACE_HINTS: Partial<Record<ServiceCredentialKey, string>> = {
  ISU_KEYCLOAK_IDENTITY: 'Cookie KEYCLOAK_IDENTITY с id.itmo.ru',
  MY_ITMO_REFRESH_TOKEN: 'Refresh-токен технического аккаунта; access- и ID-токен обновятся сами',
  GEMINI_API_KEY: 'Ключ из Google AI Studio',
};

function Time({ value }: { value: string | null }) {
  return value ? (
    <span className={styles.nowrap}>{formatDateTime(value)}</span>
  ) : (
    <span className="m3-muted">—</span>
  );
}

function Status({ credential }: { credential: ServiceCredential }) {
  const status = CREDENTIAL_STATUSES[credential.status];
  const failed = credential.status === 'FAILED' || credential.status === 'EXPIRED';
  return (
    <span className={styles.cell}>
      <Badge tone={status.tone}>{status.label}</Badge>
      {failed && credential.lastError && (
        <code className={styles.code}>{credential.lastError}</code>
      )}
      {failed && credential.lastErrorAt && (
        <span className="m3-muted">{formatDateTime(credential.lastErrorAt)}</span>
      )}
    </span>
  );
}

function Source({ credential }: { credential: ServiceCredential }) {
  const { updatedSource: source, updatedByIsu: isu } = credential;
  if (!source) return null;
  if (source !== 'ADMIN') return <span className="m3-muted">{CREDENTIAL_SOURCES[source]}</span>;
  if (isu === null) return null;
  return (
    <span className="m3-muted">
      <Link to={`/admin/users/${isu}`}>{credential.updatedByName ?? `ИСУ ${isu}`}</Link>
      {credential.updatedByName && ` · ИСУ ${isu}`}
    </span>
  );
}

function columns(onReplace: (key: ServiceCredentialKey) => void): TableColumn<ServiceCredential>[] {
  return [
    {
      key: 'name',
      header: 'Значение',
      minWidth: 176,
      render: (credential) => CREDENTIALS[credential.key],
    },
    {
      key: 'status',
      header: 'Статус',
      minWidth: 140,
      render: (credential) => <Status credential={credential} />,
    },
    {
      key: 'expires',
      header: 'Истекает',
      render: (credential) => (
        <span className={styles.cell}>
          <Time value={credential.expiresAt} />
          {credential.expiresSoon && <Badge tone="warning">Скоро</Badge>}
        </span>
      ),
    },
    {
      key: 'used',
      header: 'Использовано',
      render: (credential) => <Time value={credential.lastUsedAt} />,
    },
    {
      key: 'renewed',
      header: 'Обновлено у сервиса',
      render: (credential) => <Time value={credential.lastRenewedAt} />,
    },
    {
      key: 'updated',
      header: 'Изменено',
      render: (credential) => (
        <span className={styles.cell}>
          <Time value={credential.updatedAt} />
          <Source credential={credential} />
        </span>
      ),
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">Действия</span>,
      width: 120,
      align: 'end',
      render: (credential) =>
        credential.replaceable && (
          <Button variant="text" size="small" icon="key" onClick={() => onReplace(credential.key)}>
            Заменить
          </Button>
        ),
    },
  ];
}

export function CredentialsCard() {
  const credentials = useServiceCredentials();
  const [replacing, setReplacing] = useState<ServiceCredentialKey | null>(null);
  return (
    <Card as="section" aria-label="Учётные данные" className={styles.wide}>
      <CardHeader
        title="Учётные данные"
        subtitle="Секреты внешних сервисов. Значения не показываются"
      />
      {credentials.isError ? (
        <ErrorState
          compact
          title="Не удалось загрузить учётные данные"
          description={errorText(credentials.error, 'Попробуйте ещё раз.')}
          onRetry={() => void credentials.refetch()}
          retrying={credentials.isFetching}
        />
      ) : (
        <Table
          caption="Учётные данные"
          columns={columns(setReplacing)}
          rows={credentials.data ?? []}
          rowKey={(credential) => credential.key}
          loading={credentials.isPending}
          bleed
        />
      )}
      {replacing && (
        <ReplaceCredentialDialog credentialKey={replacing} onClose={() => setReplacing(null)} />
      )}
    </Card>
  );
}

/** The value lives only in this field and the request body; it is never shown back. */
function ReplaceCredentialDialog({
  credentialKey,
  onClose,
}: {
  credentialKey: ServiceCredentialKey;
  onClose: () => void;
}) {
  const snackbars = useSnackbars();
  const replace = useReplaceServiceCredential();
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const invalid = replace.error instanceof ApiError && replace.error.status === 400;
  const trimmed = value.trim();

  const close = () => {
    setValue('');
    replace.reset();
    onClose();
  };

  const submit = () => {
    if (!trimmed || replace.isPending) return;
    replace.mutate(
      { key: credentialKey, value: trimmed },
      {
        onSuccess: () => {
          close();
          snackbars.show('Значение заменено');
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400) return;
          snackbars.error(errorText(error, 'Не удалось заменить значение'));
        },
      },
    );
  };

  return (
    <Dialog
      open
      onClose={close}
      title="Заменить значение"
      description={CREDENTIALS[credentialKey]}
      dismissible={!replace.isPending}
      initialFocusRef={inputRef}
      size="medium"
      actions={
        <>
          <Button variant="text" onClick={close} disabled={replace.isPending}>
            Отмена
          </Button>
          <Button type="submit" form={formId} loading={replace.isPending} disabled={!trimmed}>
            Заменить
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField
          ref={inputRef}
          label="Новое значение"
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          hint={REPLACE_HINTS[credentialKey]}
          error={invalid ? 'Проверьте значение' : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (replace.isError) replace.reset();
          }}
        />
      </form>
    </Dialog>
  );
}
