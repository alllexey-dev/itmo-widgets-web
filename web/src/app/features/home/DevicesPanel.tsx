import { Button } from '@astryxdesign/core/Button';
import { Item } from '@astryxdesign/core/Item';
import { Link } from '@astryxdesign/core/Link';
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import { useResource } from '../../lib/data';
import { IconTile } from '../../lib/IconTile';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { useUser } from '../../lib/session';
import { devices } from './api';
import { deviceRows } from './devices';
import { Note } from './Note';
import { Rows } from './Rows';

const SHOWN = 5;

/**
 * "Устройства": where the account is signed in; disconnecting one is on Устройства. The last line
 * is the way to Профиль и приватность, which the navigation shows only in the account menu.
 */
export function DevicesPanel() {
  const user = useUser();
  const list = useResource(devices);
  return (
    <Panel
      title="Устройства"
      action={<Button label="Все устройства" href="/me/devices" variant="ghost" size="sm" />}
    >
      <Loadable
        resource={list}
        label="Загружаем устройства"
        errorTitle="Не удалось загрузить устройства"
        isCompact
      >
        {(data) => {
          const rows = deviceRows(data, user.connection.id);
          return (
            <>
              <Rows label="Устройства">
                {rows.slice(0, SHOWN).map((device) => (
                  <Item
                    as="li"
                    key={device.id}
                    startContent={<IconTile icon={device.icon} />}
                    label={device.title}
                    description={device.text}
                    descriptionLines={2}
                    endContent={
                      device.isOnline ? (
                        <StatusDot variant="success" label="В сети" tooltip="В сети" />
                      ) : device.seen ? (
                        <Text type="supporting" color="secondary" hasTabularNumbers>
                          {device.seen}
                        </Text>
                      ) : undefined
                    }
                  />
                ))}
              </Rows>
              {rows.length > SHOWN ? (
                <Note>И ещё {rows.length - SHOWN} на странице «Устройства»</Note>
              ) : null}
              <Note>
                Кто видит ваше расписание, спорт и друзей —{' '}
                <Link href="/me" hasUnderline>
                  Профиль и приватность
                </Link>
              </Note>
            </>
          );
        }}
      </Loadable>
    </Panel>
  );
}
