// The system tab: the background jobs and the credentials Backend works with.

import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { VStack } from '@astryxdesign/core/Stack';
import { pixel, proportional, type TableColumn } from '@astryxdesign/core/Table';
import { Link } from '@astryxdesign/core/Link';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';

import type { Resource } from '../../lib/data';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import {
  CREDENTIAL_FIELD,
  CREDENTIAL_LABEL,
  CREDENTIAL_SOON,
  credentialState,
  REVIEW_CHECK_NAME,
  SYNC_NAME,
} from '../../lib/metricLabels';
import { useCredentials, useReviewsSync, useSport, useSummaries, useVerification } from './api';
import { SystemJobExamples, SystemLoadExamples } from './ExampleBlocks';
import type { MetricId } from './metrics';
import { sportHealth, summariesHealth, syncHealth, verificationHealth, type Health } from './model';
import { isExample, NameCell, Num, Section, SourcePanel, StatusLine, TabFrame } from './parts';
import { DataTable } from './tables';
import type { Credential } from './types';

/** One background job: its state by the latest run and a line of detail, from its own source. */
function JobCard<T>({
  name,
  text,
  resource,
  healthOf,
}: {
  name: string;
  text: string;
  resource: Resource<T>;
  healthOf: (data: T) => Health;
}) {
  return (
    <Card padding={4} role="group" aria-label={name}>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <Heading level={4} accessibilityLevel={3}>
            {name}
          </Heading>
          <Text type="supporting" color="secondary">
            {text}
          </Text>
        </VStack>
        <Loadable
          resource={resource}
          label={`Загружаем: ${name}`}
          errorTitle="Не удалось загрузить"
          isInline
        >
          {(data) => {
            const health = healthOf(data);
            return (
              <VStack gap={1}>
                <StatusLine health={health} />
                <Text type="supporting" color="secondary">
                  {health.detail}
                </Text>
              </VStack>
            );
          }}
        </Loadable>
      </VStack>
    </Card>
  );
}

/** The metrics of the load section: it is shown while at least one of them is an example. */
const LOAD_METRICS: readonly MetricId[] = [
  'requests',
  'latency',
  'error_rate',
  'upstream',
  'routes',
];

interface CredentialRow extends Record<string, unknown> {
  id: string;
  credential: Credential;
}

const moment = (value: string | null) => (value ? formatRelative(value) : '—');

const CREDENTIAL_COLUMNS: TableColumn<CredentialRow>[] = [
  {
    key: 'name',
    header: CREDENTIAL_FIELD.name,
    width: proportional(2, { minWidth: 180 }),
    renderCell: ({ credential }) => (
      <NameCell name={CREDENTIAL_LABEL[credential.key]} note={credential.lastError ?? undefined} />
    ),
  },
  {
    key: 'status',
    header: CREDENTIAL_FIELD.state,
    width: proportional(1.2, { minWidth: 124 }),
    renderCell: ({ credential }) => <StatusLine health={credentialState(credential)} />,
  },
  {
    key: 'expiresAt',
    header: CREDENTIAL_FIELD.expires,
    width: pixel(200),
    renderCell: ({ credential }) => (
      <span className="st-status">
        <Num isMuted>{credential.expiresAt ? formatDateTime(credential.expiresAt) : '—'}</Num>
        {credentialState(credential).isExpiringSoon ? (
          <Token size="sm" color="yellow" label={CREDENTIAL_SOON} />
        ) : null}
      </span>
    ),
  },
  {
    key: 'lastUsedAt',
    header: CREDENTIAL_FIELD.used,
    width: pixel(124),
    renderCell: ({ credential }) => <Num isMuted>{moment(credential.lastUsedAt)}</Num>,
  },
  {
    key: 'updatedAt',
    header: CREDENTIAL_FIELD.changed,
    width: pixel(124),
    renderCell: ({ credential }) => <Num isMuted>{moment(credential.updatedAt)}</Num>,
  },
];

export function SystemTab() {
  const sport = useSport();
  const sync = useReviewsSync();
  const summaries = useSummaries();
  const verification = useVerification();
  const credentials = useCredentials();
  return (
    <TabFrame tab="system">
      <Section
        title="Фоновые задачи"
        text="Что Бэкенд делает сам по расписанию: состояние по последнему запуску"
      >
        <div className="st-jobs">
          <JobCard
            name="Каталог спорта"
            text="Обновление занятий, по которым работают автозапись и очереди"
            resource={sport}
            healthOf={sportHealth}
          />
          <JobCard
            name="Внешние отзывы"
            text={`${SYNC_NAME} копии базы проекта Reviews`}
            resource={sync}
            healthOf={syncHealth}
          />
          <JobCard
            name="ИИ-сводки"
            text="Пересчёт сводок по отзывам о преподавателях"
            resource={summaries}
            healthOf={summariesHealth}
          />
          <JobCard
            name={REVIEW_CHECK_NAME}
            text="Вёл ли преподаватель у автора отзыва"
            resource={verification}
            healthOf={verificationHealth}
          />
        </div>
        <SystemJobExamples />
      </Section>
      <SourcePanel
        title="Ключи и токены"
        hint={
          <>
            Доступы Бэкенда к My ITMO, ИСУ и Gemini. Заменить ключ можно{' '}
            <Link href="/admin/system" type="supporting" display="inline" hasUnderline>
              на странице «Система»
            </Link>
            .
          </>
        }
        resource={credentials}
      >
        {(list) => (
          <DataTable
            rows={list.map((credential) => ({ id: credential.key, credential }))}
            columns={CREDENTIAL_COLUMNS}
            label="Ключи и токены"
          />
        )}
      </SourcePanel>
      {LOAD_METRICS.some(isExample) ? (
        <Section
          title="Нагрузка и ошибки"
          text="Сколько запросов обрабатывает Бэкенд, как быстро отвечает и где ошибается"
        >
          <SystemLoadExamples />
        </Section>
      ) : null}
    </TabFrame>
  );
}
