import { Link } from '@astryxdesign/core/Link';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

import { BrandIcon } from '../../shared/BrandIcon';
import { frameCopy, type Lang } from './i18n';
import { DELETE_ACCOUNT, GITHUB, ISSUES, PRIVACY, TELEGRAM } from './links';

/** The footer of every public page: the policy, account deletion, contacts and the unofficial note. */
export function SiteFooter({ lang = 'ru' }: { lang?: Lang }) {
  const copy = frameCopy[lang];
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-inner">
        <HStack as="nav" aria-label={copy.footerLabel} gap={5} wrap="wrap" vAlign="center">
          <Link href={PRIVACY} isStandalone color="secondary">
            {copy.privacyPolicy}
          </Link>
          <Link href={DELETE_ACCOUNT} isStandalone color="secondary">
            {copy.deleteAccount}
          </Link>
          <Link href={GITHUB} isStandalone color="secondary" target="_blank" rel="noreferrer">
            <BrandIcon className="site-brand-icon" brand="github" />
            GitHub
          </Link>
          <Link href={TELEGRAM} isStandalone color="secondary" target="_blank" rel="noreferrer">
            <BrandIcon className="site-brand-icon" brand="telegram" />
            Telegram
          </Link>
          <Link href={ISSUES} isStandalone color="secondary" target="_blank" rel="noreferrer">
            {copy.issues}
          </Link>
        </HStack>
        <Text type="supporting" color="secondary">
          {copy.unofficial}
        </Text>
      </div>
    </footer>
  );
}
