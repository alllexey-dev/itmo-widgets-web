import { Link } from '@astryxdesign/core/Link';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';

import { BrandIcon } from '../../shared/BrandIcon';
import { DELETE_ACCOUNT, GITHUB, ISSUES, PRIVACY, TELEGRAM } from './links';

/** The footer of every public page: the policy, account deletion, contacts and the unofficial note. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-wrap site-footer-inner">
        <HStack as="nav" aria-label="Ссылки" gap={5} wrap="wrap" vAlign="center">
          <Link href={PRIVACY} isStandalone color="secondary">
            Политика конфиденциальности
          </Link>
          <Link href={DELETE_ACCOUNT} isStandalone color="secondary">
            Удаление аккаунта
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
            Сообщить о проблеме
          </Link>
        </HStack>
        <Text type="supporting" color="secondary">
          © 2026 alllexey · Неофициальное приложение. Не связано с Университетом ИТМО.
        </Text>
      </div>
    </footer>
  );
}
