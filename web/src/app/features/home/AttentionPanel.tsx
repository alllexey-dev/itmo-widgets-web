import { Button } from '@astryxdesign/core/Button';
import { Center } from '@astryxdesign/core/Center';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Item } from '@astryxdesign/core/Item';
import { Spinner } from '@astryxdesign/core/Spinner';
import { ChevronRight, CircleAlert, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { useResource, type Resource } from '../../lib/data';
import { IconTile } from '../../lib/IconTile';
import { LoadError } from '../../lib/LoadError';
import { Panel } from '../../lib/Panel';
import { hasAccess, useUser } from '../../lib/session';
import {
  aiSummaries,
  credentials,
  incomingRequests,
  openCases,
  reviewsSync,
  sportAutomation,
  sportOverview,
} from './api';
import {
  aiRows,
  caseRows,
  credentialRows,
  freedPlaceRows,
  requestRows,
  reviewsRows,
  sportAutomationRows,
  type AttentionRow,
} from './attention';
import { Rows } from './Rows';
import './home.css';

interface Check {
  /** What could not be checked, in "Не удалось проверить ...". */
  name: string;
  resource: Resource<unknown>;
  rows: AttentionRow[];
}

function check<T>(name: string, resource: Resource<T>, build: (data: T) => AttentionRow[]): Check {
  return { name, resource, rows: resource.data === undefined ? [] : build(resource.data) };
}

/**
 * "Требует внимания": what waits for the visitor, from requests that exist anyway. Everyone gets
 * freed sport places and friend requests; a moderator also the queue; an administrator also the
 * service credentials, sport automation, AI summaries and the reviews sync.
 */
export function AttentionPanel() {
  const user = useUser();
  const moderator = hasAccess(user, 'moderator');
  const admin = hasAccess(user, 'admin');

  const cases = useResource(moderator ? openCases : null);
  const keys = useResource(admin ? credentials : null);
  const automation = useResource(admin ? sportAutomation : null);
  const ai = useResource(admin ? aiSummaries : null);
  const sync = useResource(admin ? reviewsSync : null);
  const sport = useResource(sportOverview);
  const requests = useResource(incomingRequests);

  const checks: Check[] = [
    ...(moderator ? [check('очередь модерации', cases, (page) => caseRows(page))] : []),
    ...(admin
      ? [
          check('учётные данные', keys, (list) => credentialRows(list)),
          check('автозапись', automation, (status) => sportAutomationRows(status)),
          check('ИИ-сводки', ai, (summaries) => aiRows(summaries)),
          check('синхронизацию отзывов', sync, (state) => reviewsRows(state)),
        ]
      : []),
    check('очереди на спорт', sport, freedPlaceRows),
    check('заявки в друзья', requests, requestRows),
  ];

  const rows = checks.flatMap((item) => item.rows);
  const failed = checks.filter(
    ({ resource }) => resource.data === undefined && resource.error != null && !resource.loading,
  );
  const busy = checks.some(({ resource }) => resource.loading);
  const settled = checks.every(
    ({ resource }) => resource.data !== undefined || (resource.error != null && !resource.loading),
  );
  // Rows appear together once every source has answered, so the panel does not grow row by row.
  const [ready, setReady] = useState(settled);
  if (settled && !ready) setReady(true);

  const retry = () => failed.forEach(({ resource }) => resource.reload());

  return (
    <Panel title="Требует внимания">
      {!ready ? (
        <Center padding={4}>
          <Spinner size="md" aria-label="Проверяем, что требует внимания" />
        </Center>
      ) : failed.length === checks.length ? (
        <LoadError
          error={failed[0]?.resource.error}
          title="Не удалось проверить"
          onRetry={retry}
          isCompact
        />
      ) : (
        <div className="home-busy" aria-busy={busy} data-busy={busy}>
          {rows.length > 0 ? (
            <Rows label="Требует внимания">
              {rows.map((row) => (
                <Item
                  as="li"
                  key={row.key}
                  href={row.href}
                  startContent={<IconTile icon={row.icon} tone={row.tone} />}
                  label={row.title}
                  description={row.text}
                  labelLines={2}
                  descriptionLines={2}
                  endContent={<ChevronRight size={18} className="home-chevron" />}
                />
              ))}
            </Rows>
          ) : null}
          {rows.length === 0 && failed.length === 0 ? (
            <EmptyState
              icon={<CircleCheck size={32} />}
              title="Всё в порядке"
              description="Сейчас ничего не требует внимания."
              headingLevel={3}
              isCompact
            />
          ) : null}
          {failed.length > 0 ? (
            <Item
              role="alert"
              startContent={<IconTile icon={CircleAlert} tone="error" />}
              label={`Не удалось проверить ${failed.map((item) => item.name).join(', ')}`}
              labelLines={3}
              endContent={<Button label="Повторить" variant="ghost" size="sm" onClick={retry} />}
            />
          ) : null}
        </div>
      )}
    </Panel>
  );
}
