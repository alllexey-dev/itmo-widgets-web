import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';

import { BrandIcon } from '../../shared/BrandIcon';
import { APP_STORE, GOOGLE_PLAY, IS_IN_GOOGLE_PLAY, LATEST_RELEASE } from '../site/links';
import { SitePage } from '../site/SitePage';

import './link.css';

/**
 * The page behind a link that the app opens, for someone who has no app: a card with the
 * name of the thing and where to get the app. It never shows the identifier from the address,
 * never calls the API and ships without React.
 */
export function LinkPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SitePage header="brand">
      <VStack hAlign="center" className="lk">
        <Card padding={8} className="lk-card">
          <VStack gap={4} hAlign="center">
            <img className="lk-icon" src="/img/icon.webp" alt="" width={64} height={64} />
            <Heading level={1} type="display-3" weight="bold" justify="center" textWrap="balance">
              {title}
            </Heading>
            {children}
          </VStack>
        </Card>
      </VStack>
    </SitePage>
  );
}

export function LinkText({
  color = 'primary',
  children,
}: {
  color?: 'primary' | 'secondary';
  children: ReactNode;
}) {
  return (
    <Text as="p" display="block" size="lg" color={color} justify="center" textWrap="pretty">
      {children}
    </Text>
  );
}

export function LinkNote({ children }: { children: ReactNode }) {
  return (
    <Text as="p" display="block" type="supporting" color="secondary" justify="center">
      {children}
    </Text>
  );
}

/** The download buttons of a link page: App Store, Google Play, APK; `apk` is the variant of the APK button. */
export function LinkActions({
  apk,
  children,
}: {
  apk: 'primary' | 'secondary';
  children?: ReactNode;
}) {
  return (
    <HStack gap={2} wrap="wrap" hAlign="center" className="lk-actions">
      {children}
      <Button
        label="App Store"
        variant="secondary"
        size="lg"
        icon={<BrandIcon brand="apple" size={18} />}
        href={APP_STORE}
      />
      {IS_IN_GOOGLE_PLAY ? (
        <Button
          label="Google Play"
          variant="secondary"
          size="lg"
          icon={<BrandIcon brand="googleplay" size={18} />}
          href={GOOGLE_PLAY}
        />
      ) : null}
      <Button
        label="Скачать APK"
        variant={apk}
        size="lg"
        icon={<BrandIcon brand="github" size={18} />}
        href={LATEST_RELEASE}
      />
    </HStack>
  );
}

export function PlayNote() {
  return IS_IN_GOOGLE_PLAY ? null : <LinkNote>Google Play — скоро</LinkNote>;
}

/**
 * A profile or sport link. The apps open these addresses themselves (App Links on Android,
 * Universal Links on iPhone), so the page is seen without the app. `public/link/link.js`, loaded
 * by these two documents only, finds the button by its id: on Android it becomes an `intent://`
 * link, elsewhere it is hidden (an iPhone never opens a Universal Link from a page of its own site).
 */
export function AppLinkPage({ title }: { title: string }) {
  return (
    <LinkPage title={title}>
      <LinkText>
        ITMO.Widgets&nbsp;— неофициальное приложение для студентов ИТМО: расписание, зачётка, спорт
        и&nbsp;друзья.
      </LinkText>
      <LinkText color="secondary">
        Ссылка открывается в&nbsp;приложении на&nbsp;Android и&nbsp;iPhone. Если приложения ещё
        нет, установите его и&nbsp;откройте ссылку снова.
      </LinkText>
      <LinkActions apk="secondary">
        <Button id="open-app" label="Открыть в приложении" variant="primary" size="lg" href="" />
      </LinkActions>
      <LinkNote>
        <Link href="/" hasUnderline>
          Что это за приложение и&nbsp;как установить его на Android и&nbsp;iPhone
        </Link>
      </LinkNote>
      <PlayNote />
    </LinkPage>
  );
}
