import { VStack } from '@astryxdesign/core/Stack';
import { StatusDot, type StatusDotVariant } from '@astryxdesign/core/StatusDot';
import { Tab, TabList } from '@astryxdesign/core/TabList';
import { useId } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useApiQuery } from '../../lib/data';
import { credentialState, isCredentialBroken } from '../../lib/metricLabels';
import { PageHeader } from '../../lib/PageHeader';
import { useQueryState } from '../../lib/router';
import { CREDENTIALS_PATH, SPORT_PATH, STATISTICS_HREF } from './api';
import { KeysTab } from './KeysTab';
import { ModerationTab } from './ModerationTab';
import { SportTab } from './SportTab';
import './system.css';
import type { ServiceCredential, SportStatus } from './types';
import { VersionsTab } from './VersionsTab';

const TABS = [
  { id: 'keys', label: 'Ключи' },
  { id: 'versions', label: 'Версии' },
  { id: 'sport', label: 'Спорт' },
  { id: 'moderation', label: 'Модерация' },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface Alert {
  tone: StatusDotVariant;
  label: string;
}

/** A value that does not work, or one that is about to expire. */
function keysAlert(credentials: readonly ServiceCredential[] | undefined): Alert | null {
  if (!credentials) return null;
  if (credentials.some(isCredentialBroken)) return { tone: 'error', label: 'есть нерабочие' };
  if (credentials.some((credential) => credentialState(credential).isExpiringSoon)) {
    return { tone: 'warning', label: 'скоро истекают' };
  }
  return null;
}

/** The latest catalogue run did not go through. */
function sportAlert(sport: SportStatus | undefined): Alert | null {
  const outcome = sport?.runs[0]?.outcome;
  if (outcome === 'FAILED') return { tone: 'error', label: 'последний запуск упал' };
  if (outcome === 'PARTIAL') return { tone: 'warning', label: 'последний запуск прошёл частично' };
  return null;
}

/** Client and version statistics live in Статистика; the address of the former tab leads there. */
const MOVED: Record<string, string> = { clients: STATISTICS_HREF };

const DEFAULT_TAB: TabId = 'keys';
/** The address of the former sport page. */
const SPORT_ADDRESS = '/admin/sport';

/**
 * Система: operations in four tabs. `/admin/sport` opens the same page at Спорт and means that tab
 * only: another tab picked there opens at `/admin/system`.
 */
export default function SystemPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  // `/admin/sport` always is the Спорт tab; any other tab lives at `/admin/system`.
  const isSportAddress = pathname.replace(/\/$/, '') === SPORT_ADDRESS;
  const [query, setQuery] = useQueryState<{ tab: string }>({ tab: DEFAULT_TAB });
  const tab: TabId = isSportAddress
    ? 'sport'
    : (TABS.find((item) => item.id === query.tab)?.id ?? DEFAULT_TAB);
  const panelId = useId();
  const moved = isSportAddress ? undefined : MOVED[query.tab];

  function open(next: string) {
    if (!isSportAddress) setQuery({ tab: next });
    else if (next !== 'sport') {
      void navigate(next === DEFAULT_TAB ? '/admin/system' : `/admin/system?tab=${next}`);
    }
  }

  // The tabs mark what needs attention, so the owner sees it from any tab. The same cached answers
  // serve the tabs themselves.
  const credentials = useApiQuery<ServiceCredential[]>(CREDENTIALS_PATH);
  const sport = useApiQuery<SportStatus>(SPORT_PATH);
  const alerts: Partial<Record<TabId, Alert | null>> = {
    keys: keysAlert(credentials.data),
    sport: sportAlert(sport.data),
  };

  if (moved) return <Navigate to={moved} replace />;

  return (
    <VStack gap={6}>
      <PageHeader
        title="Система"
        text="Ключи, версии приложения, автозапись на спорт и правила модерации"
      />
      <TabList
        role="tablist"
        aria-label="Разделы системы"
        value={tab}
        onChange={open}
        hasDivider
        overflow="scroll"
      >
        {TABS.map(({ id, label }) => {
          const alert = alerts[id];
          return (
            <Tab
              key={id}
              value={id}
              label={label}
              panelId={panelId}
              endContent={
                alert ? (
                  <span className="system-tab-alert">
                    <StatusDot variant={alert.tone} label={alert.label} />
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </TabList>
      <div className="system-tab" id={panelId} role="tabpanel" aria-label={labelOf(tab)}>
        {tab === 'keys' ? <KeysTab /> : null}
        {tab === 'versions' ? <VersionsTab /> : null}
        {tab === 'sport' ? <SportTab /> : null}
        {tab === 'moderation' ? <ModerationTab /> : null}
      </div>
    </VStack>
  );
}

function labelOf(tab: TabId): string {
  return TABS.find((item) => item.id === tab)?.label ?? '';
}
