import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Item } from '@astryxdesign/core/Item';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Dumbbell } from 'lucide-react';
import { useApiQuery } from '../../lib/data';
import { counted } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { bookingsPath } from './api';
import { isDenied } from './denied';
import { Hidden } from './Hidden';
import { entryKind, entryLesson, entryStatus } from './labels';
import './people.css';
import type { UserSportBookings } from './types';

interface Props {
  isu: number;
  /** The profile's `canViewSport`: without it nothing is asked. */
  allowed: boolean;
}

/**
 * The person's sport: queue entries with their lessons. Confirmed bookings come as lesson IDs
 * without names, so they are only counted.
 */
export function SportCard({ isu, allowed }: Props) {
  const bookings = useApiQuery<UserSportBookings>(allowed ? bookingsPath(isu) : null);

  return (
    <Panel title="Спорт">
      {isDenied(allowed, bookings) ? (
        <Hidden title="Спорт скрыт" />
      ) : (
        <Loadable
          resource={bookings}
          label="Загружаем спорт"
          errorTitle="Не удалось загрузить спорт"
          isCompact
        >
          {({ entries, lessonIds }) =>
            entries.length === 0 && lessonIds.length === 0 ? (
              <EmptyState
                icon={<Dumbbell size={32} />}
                title="Записей на спорт нет"
                headingLevel={3}
                isCompact
              />
            ) : (
              <>
                {entries.length > 0 ? (
                  <ul
                    className="person-rows"
                    data-wide-end
                    role="list"
                    aria-label="Очереди на спорт"
                  >
                    {entries.map((entry) => {
                      const lesson = entryLesson(entry);
                      return (
                        <Item
                          as="li"
                          key={`${entry.type}-${entry.id}`}
                          startContent={<IconTile icon={Dumbbell} />}
                          label={lesson.section}
                          description={`${lesson.when} · ${entryStatus(entry)}`}
                          descriptionLines={2}
                          endContent={
                            <Token
                              label={entryKind(entry)}
                              size="sm"
                              color={entry.status === 'NOTIFIED' ? 'green' : 'default'}
                            />
                          }
                        />
                      );
                    })}
                  </ul>
                ) : null}
                {lessonIds.length > 0 ? (
                  // Backend gives only the IDs of these lessons, so the line counts them and says
                  // where they can be seen instead of promising a list.
                  <Text
                    as="p"
                    display="block"
                    type="supporting"
                    color="secondary"
                    className="person-note"
                  >
                    {entries.length > 0 ? 'И ' : ''}
                    {counted(lessonIds.length, [
                      'подтверждённая запись',
                      'подтверждённые записи',
                      'подтверждённых записей',
                    ])}{' '}
                    на занятия: какие именно, видно в приложении.
                  </Text>
                ) : null}
              </>
            )
          }
        </Loadable>
      )}
    </Panel>
  );
}
