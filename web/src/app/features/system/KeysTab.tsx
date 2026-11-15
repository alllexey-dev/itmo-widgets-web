import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { Link } from '@astryxdesign/core/Link';
import { List, ListItem } from '@astryxdesign/core/List';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, Table, type TableColumn } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { Token } from '@astryxdesign/core/Token';
import { useId, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errors';
import { useApiMutation, useApiQuery } from '../../lib/data';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { useNotify } from '../../lib/notify';
import { Panel } from '../../lib/Panel';
import { Mono } from '../../lib/Mono';
import {
  CREDENTIAL_FIELD,
  CREDENTIAL_LABEL,
  CREDENTIAL_SOON,
  CREDENTIAL_SOON_TEXT,
  credentialState,
} from '../../lib/metricLabels';
import {
  AUDIT_PREFIX,
  awaitsCheck,
  CREDENTIALS_PATH,
  isCredentialValue,
  POLL_MILLIS,
  replaceCredential,
} from './api';
import {
  CREDENTIAL_EFFECTS,
  CREDENTIAL_HINTS,
  CREDENTIAL_SOURCES,
  CREDENTIAL_VALUE_RULE,
  expiryText,
} from './labels';
import { State } from './parts';
import type { ServiceCredential, ServiceCredentialKey } from './types';

type Row = ServiceCredential & Record<string, unknown>;

const isBroken = (credential: ServiceCredential) =>
  credential.status === 'FAILED' || credential.status === 'EXPIRED';

/**
 * Below this width the five columns no longer fit beside the navigation, and the table gives way to
 * rows that stack a key's fields.
 */
const NARROW = '(max-width: 1000px)';

/**
 * When the key was last used. Backend keeps that time when a value is replaced, so until the new
 * value's first use (`UNKNOWN`) it is the time of the value before it.
 */
function usedText(credential: ServiceCredential): string {
  if (!credential.lastUsedAt) return 'не использовался';
  const when = formatRelative(credential.lastUsedAt);
  return credential.status === 'UNKNOWN'
    ? `прежнее значение использовано ${when}`
    : `использован ${when}`;
}

/** The state of a key and, for a broken one, what Backend said and when. */
function Status({ credential }: { credential: ServiceCredential }) {
  const state = credentialState(credential);
  return (
    <span className="system-cell">
      <State tone={state.tone} label={state.label} />
      {isBroken(credential) && credential.lastError ? (
        <Mono tone="error">{credential.lastError}</Mono>
      ) : null}
      {isBroken(credential) && credential.lastErrorAt ? (
        <Text type="supporting" color="secondary">
          {formatDateTime(credential.lastErrorAt)}
        </Text>
      ) : null}
    </span>
  );
}

/** Who put the value there: an administrator by name, or the source for anything else. */
function ChangedBy({ credential }: { credential: ServiceCredential }) {
  if (credential.updatedSource === 'ADMIN' && credential.updatedByIsu !== null) {
    return (
      <Link href={`/admin/users/${credential.updatedByIsu}`} type="supporting">
        {credential.updatedByName ?? `ИСУ ${credential.updatedByIsu}`}
      </Link>
    );
  }
  return credential.updatedSource && credential.updatedSource !== 'ADMIN' ? (
    <Text type="supporting" color="secondary">
      {CREDENTIAL_SOURCES[credential.updatedSource]}
    </Text>
  ) : null;
}

/** The keys as stacked rows: everything a table row says, with the action under the text. */
function KeysList({
  credentials,
  onReplace,
}: {
  credentials: ServiceCredential[];
  onReplace: (key: ServiceCredentialKey) => void;
}) {
  return (
    <List aria-label="Ключи и доступы" hasDividers>
      {credentials.map((credential) => (
        <ListItem
          key={credential.key}
          align="start"
          label={CREDENTIAL_LABEL[credential.key]}
          description={
            <VStack gap={1}>
              <Status credential={credential} />
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {[
                  usedText(credential),
                  credential.expiresAt ? `истекает ${expiryText(credential.expiresAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {credentialState(credential).isExpiringSoon ? (
                <HStack>
                  <Token size="sm" color="yellow" label={CREDENTIAL_SOON_TEXT} />
                </HStack>
              ) : null}
              <HStack gap={1} vAlign="center" wrap="wrap">
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {CREDENTIAL_FIELD.changed} {formatDateTime(credential.updatedAt)}
                </Text>
                <ChangedBy credential={credential} />
              </HStack>
              {credential.replaceable ? (
                <HStack paddingBlockStart={1}>
                  <Button
                    label="Заменить"
                    aria-label={`Заменить: ${CREDENTIAL_LABEL[credential.key]}`}
                    variant="secondary"
                    size="sm"
                    onClick={() => onReplace(credential.key)}
                  />
                </HStack>
              ) : null}
            </VStack>
          }
        />
      ))}
    </List>
  );
}

function columns(onReplace: (key: ServiceCredentialKey) => void): TableColumn<Row>[] {
  return [
    {
      key: 'key',
      header: CREDENTIAL_FIELD.name,
      width: proportional(2.2, { minWidth: 190 }),
      renderCell: (credential) => (
        <span className="system-cell">
          <Text type="body" weight="medium">
            {CREDENTIAL_LABEL[credential.key]}
          </Text>
          <Text type="supporting" color="secondary">
            {usedText(credential)}
          </Text>
        </span>
      ),
    },
    {
      key: 'status',
      header: CREDENTIAL_FIELD.state,
      width: proportional(1.6, { minWidth: 140 }),
      renderCell: (credential) => <Status credential={credential} />,
    },
    {
      key: 'expiresAt',
      header: CREDENTIAL_FIELD.expires,
      width: pixel(136),
      renderCell: (credential) => (
        <span className="system-cell">
          {credential.expiresAt ? (
            <Text type="body" hasTabularNumbers>
              {expiryText(credential.expiresAt)}
            </Text>
          ) : (
            <Text type="body" color="secondary">
              —
            </Text>
          )}
          {credentialState(credential).isExpiringSoon ? (
            <Token size="sm" color="yellow" label={CREDENTIAL_SOON} />
          ) : null}
        </span>
      ),
    },
    {
      key: 'updatedAt',
      header: CREDENTIAL_FIELD.changed,
      width: proportional(1.6, { minWidth: 150 }),
      renderCell: (credential) => (
        <span className="system-cell">
          <Text type="body" hasTabularNumbers>
            {formatDateTime(credential.updatedAt)}
          </Text>
          <ChangedBy credential={credential} />
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      // Wide enough for the button at its own width: a narrower column cuts its label.
      width: pixel(148),
      align: 'end',
      renderCell: (credential) =>
        credential.replaceable ? (
          <Button
            label="Заменить"
            aria-label={`Заменить: ${CREDENTIAL_LABEL[credential.key]}`}
            variant="ghost"
            size="sm"
            onClick={() => onReplace(credential.key)}
          />
        ) : null,
    },
  ];
}

/** Ключи и доступы: states, times and who changed a value. The values never reach the browser. */
export function KeysTab() {
  // A fresh value is polled quietly until its first use shows its status or its window ends.
  const credentials = useApiQuery<ServiceCredential[]>(CREDENTIALS_PATH, undefined, {
    poll: (list) => (list && awaitsCheck(list) ? POLL_MILLIS : false),
  });
  const isNarrow = useMediaQuery(NARROW);
  const [replacing, setReplacing] = useState<ServiceCredentialKey | null>(null);

  return (
    <>
      <Panel title="Ключи и доступы">
        <Loadable
          resource={credentials}
          label="Загружаем ключи"
          errorTitle="Не удалось загрузить ключи"
          isCompact
        >
          {(list) =>
            isNarrow ? (
              <KeysList credentials={list} onReplace={setReplacing} />
            ) : (
              <Table<Row>
                aria-label="Ключи и доступы"
                className="system-keys"
                data={list as Row[]}
                columns={columns(setReplacing)}
                idKey="key"
                dividers="rows"
                verticalAlign="top"
              />
            )
          }
        </Loadable>
      </Panel>
      {replacing ? (
        <ReplaceCredentialDialog
          key={replacing}
          credential={replacing}
          onClose={() => setReplacing(null)}
        />
      ) : null}
    </>
  );
}

/**
 * The new value lives only in this password field and in the request body: it is not a mutation
 * variable and not a part of a cache key, and the dialog unmounts on close, so the field is empty
 * the next time.
 */
function ReplaceCredentialDialog({
  credential,
  onClose,
}: {
  credential: ServiceCredentialKey;
  onClose: () => void;
}) {
  const formId = useId();
  const notify = useNotify();
  const [value, setValue] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);
  const trimmed = value.trim();

  const replace = useApiMutation({
    run: () => replaceCredential(credential, trimmed),
    forgets: [CREDENTIALS_PATH, AUDIT_PREFIX],
    done: 'Значение заменено',
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || replace.isPending) return;
    // What Backend would refuse is refused here, with the rule spelled out.
    if (!isCredentialValue(trimmed)) {
      setIsInvalid(true);
      return;
    }
    replace.mutate(undefined, {
      onSuccess: onClose,
      onError: (error) => {
        // A refused value is the field's own error; anything else is a failure of the request.
        if (error instanceof ApiError && error.status === 400) setIsInvalid(true);
        else notify.error(errorText(error, 'Не удалось заменить значение'));
      },
    });
  }

  return (
    <Dialog
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen && !replace.isPending) onClose();
      }}
      purpose="form"
      width={480}
    >
      <Layout
        header={
          <DialogHeader
            title="Заменить значение"
            subtitle={CREDENTIAL_LABEL[credential]}
            onOpenChange={(isOpen) => {
              if (!isOpen && !replace.isPending) onClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <form id={formId} onSubmit={submit}>
              <VStack gap={4}>
                <TextInput
                  type="password"
                  label="Новое значение"
                  description={CREDENTIAL_HINTS[credential]}
                  value={value}
                  onChange={(next) => {
                    setValue(next);
                    setIsInvalid(false);
                  }}
                  status={isInvalid ? { type: 'error', message: CREDENTIAL_VALUE_RULE } : undefined}
                  autoComplete="off"
                  hasSpellCheck={false}
                  hasAutoFocus
                />
                <Text type="supporting" color="secondary">
                  Прежнее значение будет стёрто. {CREDENTIAL_EFFECTS[credential]} До первого
                  использования ключ останется в состоянии «Не проверено».
                </Text>
              </VStack>
            </form>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button
                label="Отмена"
                variant="ghost"
                onClick={onClose}
                isDisabled={replace.isPending}
              />
              <Button
                label="Заменить"
                variant="primary"
                type="submit"
                form={formId}
                isDisabled={!trimmed}
                isLoading={replace.isPending}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
