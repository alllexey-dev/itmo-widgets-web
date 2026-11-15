// Admin statistics: categories as tabs, each tab reading only the sources it draws. The tab lives
// in the query string (`?tab=`), so a view can be reloaded and shared.

import { VStack } from '@astryxdesign/core/Stack';
import { Tab, TabList } from '@astryxdesign/core/TabList';

import { PageHeader } from '../../lib/PageHeader';
import { useQueryState } from '../../lib/router';
import { AudienceTab } from './AudienceTab';
import { FeaturesTab } from './FeaturesTab';
import { TABS } from './labels';
import { OverviewTab } from './OverviewTab';
import { ReviewsTab } from './ReviewsTab';
import { SportTab } from './SportTab';
import './stats.css';
import { SystemTab } from './SystemTab';
import type { TabId } from './types';

const DEFAULT_TAB: TabId = 'overview';

export default function StatsPage() {
  const [query, setQuery] = useQueryState({ tab: DEFAULT_TAB as string });
  const tab = TABS.find(([id]) => id === query.tab)?.[0] ?? DEFAULT_TAB;
  const openTab = (next: string) => setQuery({ tab: next });

  return (
    <VStack gap={6} className="st-root">
      <PageHeader
        title="Статистика"
        text="Что происходит в приложении и на Бэкенде: аудитория, функции, спорт, модерация и система"
      />
      <TabList
        className="st-tabs"
        value={tab}
        onChange={openTab}
        hasDivider
        overflow="scroll"
        aria-label="Разделы статистики"
      >
        {TABS.map(([id, label]) => (
          <Tab key={id} value={id} label={label} />
        ))}
      </TabList>
      {tab === 'overview' ? <OverviewTab onOpenTab={openTab} /> : null}
      {tab === 'audience' ? <AudienceTab /> : null}
      {tab === 'features' ? <FeaturesTab /> : null}
      {tab === 'sport' ? <SportTab /> : null}
      {tab === 'reviews' ? <ReviewsTab /> : null}
      {tab === 'system' ? <SystemTab /> : null}
    </VStack>
  );
}
