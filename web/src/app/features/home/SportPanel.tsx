import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Item } from '@astryxdesign/core/Item';
import { Token } from '@astryxdesign/core/Token';
import { Dumbbell } from 'lucide-react';
import { useResource } from '../../lib/data';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { SPORT_KIND_LABEL } from '../../lib/sportLabels';
import { sportOverview } from './api';
import { Note } from './Note';
import { Rows } from './Rows';
import { sportRows } from './sport';

const SHOWN = 4;

/**
 * "Спорт": the queues the visitor waits in and the sections, in the words and under the kinds of
 * the Спорт page, where each of them is found and can be left.
 */
export function SportPanel() {
  const sport = useResource(sportOverview);
  return (
    <Panel
      title="Спорт"
      action={<Button label="Очереди и секции" href="/sport" variant="ghost" size="sm" />}
    >
      <Loadable
        resource={sport}
        label="Загружаем очереди"
        errorTitle="Не удалось загрузить очереди"
        isCompact
      >
        {(data) => {
          const rows = sportRows(data);
          if (rows.length === 0) {
            return (
              <EmptyState
                icon={<Dumbbell size={32} />}
                title="Вы не стоите в очередях"
                description="Встать в очередь можно в приложении: расписание занятий приходит из My ITMO."
                headingLevel={3}
                isCompact
              />
            );
          }
          return (
            <>
              <Rows label="Спорт" hasWideEnd>
                {rows.slice(0, SHOWN).map((row) => (
                  <Item
                    as="li"
                    key={row.id}
                    href="/sport"
                    startContent={
                      <IconTile icon={Dumbbell} tone={row.freed ? 'accent' : undefined} />
                    }
                    label={row.title}
                    description={`${row.when} · ${row.status}`}
                    descriptionLines={2}
                    endContent={
                      <Token
                        label={SPORT_KIND_LABEL[row.kind]}
                        size="sm"
                        color={row.freed ? 'green' : 'default'}
                      />
                    }
                  />
                ))}
              </Rows>
              {rows.length > SHOWN ? (
                <Note>И ещё {rows.length - SHOWN} на странице «Спорт»</Note>
              ) : null}
            </>
          );
        }}
      </Loadable>
    </Panel>
  );
}
