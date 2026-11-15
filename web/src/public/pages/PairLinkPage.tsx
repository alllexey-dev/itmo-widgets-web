import { Link } from '@astryxdesign/core/Link';

import { AGENT_GUIDE } from '../site/links';
import { LinkActions, LinkNote, LinkPage, LinkText, PlayNote } from './LinkPage';

/**
 * `/pair#v1.<code>.<key>.<secret>`: a device pairing link. The fragment holds the device's key
 * and secret, so this document ships with no script at all and loads nothing from other hosts;
 * `scripts/check-site.sh` enforces it. Never add anything here that reads the address.
 */
export default function PairLinkPage() {
  return (
    <LinkPage title="Подключение устройства к ITMO.Widgets">
      <LinkText color="secondary">
        Это ссылка для подключения вашего устройства, например веб-версии или агента автозаписи, к
        ITMO.Widgets. Откройте её на телефоне с приложением.
      </LinkText>
      <LinkText>
        В приложении: Профиль → Устройства → «Подключить устройство» → «Сканировать QR», и наведите
        камеру на QR на экране устройства. Можно и камерой телефона.
      </LinkText>
      <LinkText>
        Приложение установлено, а открылась эта страница? Скопируйте ссылку и вставьте её в
        «Подключить устройство».
      </LinkText>
      <LinkActions apk="primary" />
      <LinkNote>
        Подключайте только своё устройство.{' '}
        <Link href={AGENT_GUIDE} hasUnderline>
          Как настроить свой клиент
        </Link>
      </LinkNote>
      <PlayNote />
    </LinkPage>
  );
}
