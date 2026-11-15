import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Spinner } from '@astryxdesign/core/Spinner';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ArrowRight } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { useResource, type Resource } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { METRIC_LABEL } from '../../lib/metricLabels';
import { dashboard, serverStats, sportStats } from './api';
import { serverMetric, sportMetric, weekMetrics, type WeekMetric } from './week';
import './home.css';

/** One figure: its name above, the value with its change below. */
function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <VStack gap={1} role="group" aria-label={label}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <HStack gap={2} vAlign="end">
        {children}
      </HStack>
    </VStack>
  );
}

function Metric({ metric }: { metric: WeekMetric }) {
  return (
    <Tile label={metric.label}>
      <Text size="2xl" weight="bold" hasTabularNumbers>
        {metric.value}
      </Text>
      {metric.delta ? (
        <span className="home-delta" data-good={metric.delta.isGood} title="К предыдущим 7 дням">
          {metric.delta.text}
        </span>
      ) : null}
    </Tile>
  );
}

/**
 * A figure of its own source: it loads and fails in its tile, so the figures of the dashboard stay
 * readable when a statistics route does not answer.
 */
function SourceMetric<T>({
  label,
  resource,
  metric,
}: {
  label: string;
  resource: Resource<T>;
  metric: (data: T) => WeekMetric;
}) {
  const { data, error, loading, reload } = resource;
  if (data !== undefined) {
    return (
      <div className="home-busy" aria-busy={loading} data-busy={loading}>
        <Metric metric={metric(data)} />
      </div>
    );
  }
  if (error && !loading) {
    return (
      <Tile label={label}>
        <Text color="secondary">Не загрузилось</Text>
        <Button label="Повторить" variant="ghost" size="sm" onClick={reload} />
      </Tile>
    );
  }
  return (
    <Tile label={label}>
      <Spinner size="sm" aria-label={`Загружаем: ${label}`} />
    </Tile>
  );
}

/** "За 7 дней" for the administrator: the headline numbers and the way to Статистика. */
export function WeekCard() {
  const week = useResource(dashboard);
  // Asked together with the dashboard, not after it.
  const sport = useResource(sportStats);
  const server = useResource(serverStats);
  const titleId = useId();
  return (
    <Card padding={5}>
      <VStack as="section" gap={4} aria-labelledby={titleId}>
        <HStack hAlign="between" vAlign="center" gap={3}>
          <Heading level={2} id={titleId}>
            За 7 дней
          </Heading>
          <Button
            label="Вся статистика"
            href="/admin/dashboard"
            variant="ghost"
            size="sm"
            endContent={<ArrowRight size={16} />}
          />
        </HStack>
        <Loadable
          resource={week}
          label="Загружаем сводку"
          errorTitle="Не удалось загрузить сводку"
          isCompact
        >
          {(data) => {
            const metrics = weekMetrics(data);
            return (
              <div className="home-week-box">
                <div className="home-week" data-count={metrics.length + 2}>
                  {metrics.map((metric) => (
                    <Metric key={metric.label} metric={metric} />
                  ))}
                  <SourceMetric
                    label={METRIC_LABEL.sportSignups}
                    resource={sport}
                    metric={sportMetric}
                  />
                  <SourceMetric
                    label={METRIC_LABEL.serverErrors}
                    resource={server}
                    metric={serverMetric}
                  />
                </div>
              </div>
            );
          }}
        </Loadable>
      </VStack>
    </Card>
  );
}
