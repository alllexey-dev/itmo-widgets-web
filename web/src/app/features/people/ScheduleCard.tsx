import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { Item } from '@astryxdesign/core/Item';
import { Text } from '@astryxdesign/core/Text';
import { CalendarOff } from 'lucide-react';
import { useState } from 'react';
import { useApiQuery } from '../../lib/data';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { lessonsPath } from './api';
import { isDenied } from './denied';
import { Hidden } from './Hidden';
import { byDay, clock, formatDayTitle, lessonPlace, nextDays } from './labels';
import './people.css';
import type { Lesson } from './types';

const DAYS = 7;

interface Props {
  isu: number;
  /** The profile's `canViewSchedule`: without it nothing is asked. */
  allowed: boolean;
}

/** The schedule the person's app uploaded, for the next week. */
export function ScheduleCard({ isu, allowed }: Props) {
  // The week is fixed when the page opens, so the key does not move under a loaded answer.
  const [range] = useState(() => nextDays(DAYS));
  const lessons = useApiQuery<Lesson[]>(allowed ? lessonsPath(isu) : null, range);
  const denied = isDenied(allowed, lessons);

  return (
    <Panel
      title="Расписание"
      action={
        denied ? undefined : (
          <Text type="supporting" color="secondary">
            ближайшие 7 дней
          </Text>
        )
      }
    >
      {denied ? (
        <Hidden title="Расписание скрыто" />
      ) : (
        <Loadable
          resource={lessons}
          label="Загружаем расписание"
          errorTitle="Не удалось загрузить расписание"
          isCompact
        >
          {(data) =>
            data.length === 0 ? (
              <EmptyState
                icon={<CalendarOff size={32} />}
                title="На ближайшие 7 дней занятий нет"
                description="Расписание обновляется, когда человек открывает приложение."
                headingLevel={3}
                isCompact
              />
            ) : (
              byDay(data).map((day) => {
                const title = formatDayTitle(day.date);
                return (
                  <div key={day.date} className="person-day">
                    <Heading level={3} className="person-day-title">
                      {title}
                    </Heading>
                    <ul className="person-rows" role="list" aria-label={title}>
                      {day.lessons.map((lesson) => (
                        <Item
                          as="li"
                          key={lesson.pairId}
                          align="first-line"
                          startContent={
                            <span className="person-time">
                              <span>{clock(lesson.start)}</span>
                              <span className="person-time-end">{clock(lesson.end)}</span>
                            </span>
                          }
                          label={lesson.subjectName}
                          description={lessonPlace(lesson)}
                          labelLines={2}
                          descriptionLines={2}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })
            )
          }
        </Loadable>
      )}
    </Panel>
  );
}
