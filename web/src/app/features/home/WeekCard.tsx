import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { ArrowRight } from 'lucide-react';
import { useId } from 'react';
import { useResource } from '../../lib/data';
import { ExampleMark } from '../../lib/ExampleMark';
import { Loadable } from '../../lib/Loadable';
import { dashboard } from './api';
import { SHOW_EXAMPLES, withExampleMetrics } from './examples';
import { weekMetrics } from './week';
import './home.css';

/** "За 7 дней" for the administrator: the headline numbers and the way to Статистика. */
export function WeekCard() {
  const week = useResource(dashboard);
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
            const metrics = SHOW_EXAMPLES
              ? withExampleMetrics(weekMetrics(data))
              : weekMetrics(data);
            return (
              <div className="home-week-box">
                <div className="home-week" data-count={metrics.length}>
                  {metrics.map((metric) => (
                    <VStack key={metric.label} gap={1} role="group" aria-label={metric.label}>
                      <HStack gap={2} vAlign="center">
                        <Text type="supporting" color="secondary">
                          {metric.label}
                        </Text>
                        {metric.isExample ? <ExampleMark /> : null}
                      </HStack>
                      <HStack gap={2} vAlign="end">
                        <Text size="2xl" weight="bold" hasTabularNumbers>
                          {metric.value}
                        </Text>
                        {metric.delta ? (
                          <span
                            className="home-delta"
                            data-good={metric.delta.isGood}
                            title="К предыдущим 7 дням"
                          >
                            {metric.delta.text}
                          </span>
                        ) : null}
                      </HStack>
                    </VStack>
                  ))}
                </div>
              </div>
            );
          }}
        </Loadable>
      </VStack>
    </Card>
  );
}
