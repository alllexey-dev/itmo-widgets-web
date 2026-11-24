import { Button } from '@astryxdesign/core/Button';
import { Card, type CardVariant } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import {
  Bot,
  CircleOff,
  Globe,
  KeyRound,
  Server,
  ServerCog,
  ShieldCheck,
  Smartphone,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandIcon } from '../../shared/BrandIcon';
import {
  AGENT,
  DELETE_ACCOUNT,
  GOOGLE_PLAY,
  IS_IN_GOOGLE_PLAY,
  LATEST_RELEASE,
  MCP,
  ALTSTORE,
  PRIVACY,
  TELEGRAM,
  WEB_APP_LOGIN,
} from '../site/links';
import { SitePage } from '../site/SitePage';

import './landing.css';

type Hue = 'blue' | 'pink' | 'yellow' | 'purple' | 'green';

/**
 * A screenshot of one platform in the system colour scheme. The browser picks the file from the
 * media query, so the prerendered HTML is right before any script runs.
 */
function PlatformScreenshot({
  platform,
  file,
  alt,
  isLazy,
}: {
  platform: 'android' | 'ios';
  file: string;
  alt: string;
  isLazy: boolean;
}) {
  return (
    <picture className={`la-os la-os--${platform}`}>
      <source srcSet={`/img/dark/${file}.webp`} media="(prefers-color-scheme: dark)" />
      <img
        src={`/img/light/${file}.webp`}
        alt={alt}
        width={540}
        height={960}
        loading={isLazy ? 'lazy' : undefined}
      />
    </picture>
  );
}

/**
 * The same screen on Android and on iPhone. Both are in the HTML and `PlatformSwitch` shows one
 * of them with CSS alone, as public pages ship without JavaScript. The iPhone frame is always
 * lazy: hidden, it is not downloaded until the visitor switches to it.
 */
function Screenshot({
  name,
  alt,
  isLazy = false,
}: {
  name: string;
  alt: string;
  isLazy?: boolean;
}) {
  return (
    <>
      <PlatformScreenshot platform="android" file={name} alt={alt} isLazy={isLazy} />
      <PlatformScreenshot platform="ios" file={`ios-${name}`} alt={alt} isLazy />
    </>
  );
}

/**
 * Chooses the platform of every screenshot on the page: two radio buttons that `landing.css`
 * reads with `:has()`. Android is the default.
 */
function PlatformSwitch() {
  return (
    <fieldset className="la-switch">
      <legend className="la-switch-legend">Скриншоты с платформы</legend>
      <div className="la-switch-track">
        <label className="la-switch-option">
          <input
            className="la-switch-input la-switch-input--android"
            type="radio"
            name="la-platform"
            value="android"
            defaultChecked
          />
          <BrandIcon brand="android" size={16} />
          Android
        </label>
        <label className="la-switch-option">
          <input
            className="la-switch-input la-switch-input--ios"
            type="radio"
            name="la-platform"
            value="ios"
          />
          <BrandIcon brand="apple" size={16} />
          iPhone
        </label>
      </div>
    </fieldset>
  );
}

/** Full phone in a device frame, used in the hero composition. */
function Phone({ name, alt, className }: { name: string; alt: string; className: string }) {
  return (
    <figure className={`la-phone ${className}`}>
      <Screenshot name={name} alt={alt} />
    </figure>
  );
}

/** Vertical focus of a cropped screenshot in percent; each value has a class in `landing.css`. */
type ShotFocus = 0 | 4 | 8 | 12 | 55 | 100;

/** A focus of the iPhone frame alone, where the two platforms lay the screen out differently. */
type IosShotFocus = 70;

/** Screenshot crop peeking out of a bento tile; `iosY` replaces `y` for the iPhone frame. */
function Shot({
  name,
  alt,
  y = 0,
  iosY,
}: {
  name: string;
  alt: string;
  y?: ShotFocus;
  iosY?: IosShotFocus;
}) {
  const ios = iosY === undefined ? '' : ` la-shot--ios-y${iosY}`;
  return (
    <figure className={`la-shot la-shot--y${y}${ios}`}>
      <Screenshot name={name} alt={alt} isLazy />
    </figure>
  );
}

/** Tinted square with an icon; the hue comes from the theme palette tokens. */
function IconChip({ icon, hue }: { icon: ReactNode; hue: Hue }) {
  return (
    <span className={`la-chip la-chip--${hue}`} aria-hidden="true">
      {icon}
    </span>
  );
}

/** The coloured shapes of the app icon, drawn with theme hue tokens. */
function Shapes() {
  return (
    <svg className="la-shapes" viewBox="0 0 640 520" aria-hidden="true" focusable="false">
      <circle className="la-shape-fill la-shape--pink" cx="112" cy="62" r="44" />
      <path className="la-shape-stroke la-shape--yellow" d="M 468 46 A 96 96 0 0 1 564 142" />
      <circle className="la-shape-fill la-shape--purple" cx="20" cy="262" r="26" />
      <path className="la-shape-stroke la-shape--green" d="M 62 392 A 92 92 0 0 0 154 484" />
      <circle className="la-shape-fill la-shape--blue" cx="556" cy="420" r="78" />
    </svg>
  );
}

function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <VStack gap={2} className="la-section-head">
      <Heading level={2} type="display-3" weight="bold" textWrap="balance">
        {title}
      </Heading>
      {lead ? (
        <Text size="lg" color="secondary" textWrap="pretty">
          {lead}
        </Text>
      ) : null}
    </VStack>
  );
}

function Hero() {
  return (
    <section className="site-wrap la-hero">
      <VStack gap={5} className="la-hero-copy">
        <HStack>
          <Token label="Для студентов ИТМО · Android и iPhone" color="blue" />
        </HStack>
        <Heading
          level={1}
          type="display-1"
          weight="bold"
          textWrap="balance"
          className="la-hero-title"
        >
          My&nbsp;ITMO, который вы&nbsp;заслужили
        </Heading>
        <Text size="xl" color="secondary" textWrap="pretty" className="la-hero-pitch">
          Расписание, QR-пропуск, зачётка, запись на&nbsp;спорт и&nbsp;друзья&nbsp;—
          в&nbsp;приложении и&nbsp;виджетах на&nbsp;главном экране.
        </Text>
        <HStack gap={2} wrap="wrap" vAlign="center">
          {IS_IN_GOOGLE_PLAY ? (
            <Button
              label="Google Play"
              size="lg"
              variant="primary"
              icon={<BrandIcon brand="googleplay" size={18} />}
              href={GOOGLE_PLAY}
              target="_blank"
              rel="noreferrer"
            />
          ) : null}
          <Button
            label="Скачать для Android"
            size="lg"
            variant={IS_IN_GOOGLE_PLAY ? 'secondary' : 'primary'}
            icon={<BrandIcon brand="android" size={18} />}
            href="#download"
          />
          <Button
            label="Для iPhone"
            size="lg"
            variant="secondary"
            icon={<BrandIcon brand="apple" size={18} />}
            href="#download"
          />
          <Button
            label="Веб-версия"
            size="lg"
            variant="ghost"
            icon={<Globe size={18} />}
            href={WEB_APP_LOGIN}
          />
        </HStack>
        <HStack gap={2} vAlign="center" className="la-hero-note">
          <ShieldCheck size={16} aria-hidden="true" />
          <Text type="supporting" color="secondary">
            Неофициальное приложение. Вход через ITMO.ID&nbsp;— пароль приложение не&nbsp;видит.
          </Text>
        </HStack>
      </VStack>

      <div className="la-showcase">
        <div className="la-stage">
          <Shapes />
          <Phone className="la-phone--left" name="qr" alt="Пропуск: QR-код, имя, группа и ИСУ" />
          <Phone
            className="la-phone--right"
            name="sport-mine"
            alt="Спорт: баллы за семестр и записи"
          />
          <Phone
            className="la-phone--center"
            name="home"
            alt="Сегодня: пара, на которую идти, и день на линии времени"
          />
        </div>
        <PlatformSwitch />
      </div>
    </section>
  );
}

interface TileProps {
  title: string;
  text: string;
  variant: CardVariant;
  /** `wide` spans two columns, `split` also puts the copy beside the visual. */
  layout?: 'single' | 'wide' | 'split';
  children: ReactNode;
}

function Tile({ title, text, variant, layout = 'single', children }: TileProps) {
  return (
    <Card variant={variant} padding={0} className={`la-tile la-tile--${layout}`}>
      <VStack gap={1} className="la-tile-copy">
        <Heading level={3} weight="bold" className="la-tile-title">
          {title}
        </Heading>
        <Text color="secondary" textWrap="pretty">
          {text}
        </Text>
      </VStack>
      <div className="la-tile-visual">{children}</div>
    </Card>
  );
}

const devices: {
  icon: LucideIcon;
  hue: Hue;
  title: string;
  text: string;
  href: string;
  isExternal: boolean;
}[] = [
  {
    icon: Globe,
    hue: 'blue',
    title: 'Веб-версия',
    text: 'В браузере',
    href: WEB_APP_LOGIN,
    isExternal: false,
  },
  {
    icon: Server,
    hue: 'green',
    title: 'itmo-widgets-agent',
    text: 'Автозапись на спорт',
    href: AGENT,
    isExternal: true,
  },
  {
    icon: Bot,
    hue: 'purple',
    title: 'itmo-mcp',
    text: 'Пары и баллы для ИИ',
    href: MCP,
    isExternal: true,
  },
];

function Features() {
  return (
    <section id="features" className="site-wrap la-section">
      <SectionHead title="Что внутри" />
      <div className="la-bento">
        <Tile
          layout="wide"
          variant="blue"
          title="Сегодня и виджеты"
          text="Ближайшая пара, аудитория и сколько осталось — в приложении и на главном экране."
        >
          <Shot name="home" alt="Сегодня: текущая пара, аудитория и время до конца" />
          <Shot name="widgets" alt="Виджеты «Расписание на день» и «Список пар»" />
        </Tile>
        <Tile
          variant="pink"
          title="QR-пропуск"
          text="Открывается в одно касание. Последний код работает без сети."
        >
          <Shot name="qr" alt="Пропуск: QR-код, имя, группа и ИСУ" y={100} />
        </Tile>
        <Tile
          variant="yellow"
          title="Расписание и маршрут"
          text="Путь до аудитории на карте кампуса. Об изменениях приложение сообщит."
        >
          <Shot name="lesson" alt="Карточка пары: аудитория, маршрут и друзья на паре" />
        </Tile>
        <Tile
          variant="purple"
          title="Зачётка и баллы"
          text="Баллы из БАРС, My ITMO и таблиц преподавателей. Новая оценка — уведомлением."
        >
          <Shot name="recordbook" alt="Зачётка: баллы и их источники" y={12} />
        </Tile>
        <Tile
          layout="wide"
          variant="green"
          title="Спорт и автозапись"
          text="Очередь займёт освободившееся место, секция запишет на занятие каждые две недели."
        >
          <Shot name="sport" alt="Запись на спорт: поиск, фильтры и свободные места" y={8} />
          <Shot name="sport-mine" alt="Моё: баллы за семестр и записи" y={8} />
        </Tile>
        <Tile
          variant="blue"
          title="Друзья"
          text="Видно, где сейчас друзья и какие пары у вас общие."
        >
          <Shot name="friends" alt="Чьё расписание: где сейчас друзья" y={4} iosY={70} />
        </Tile>
        <Tile
          layout="split"
          variant="yellow"
          title="Отзывы о преподавателях"
          text="Краткая ИИ-сводка и отзывы студентов — анонимные по умолчанию."
        >
          <Shot name="teacher" alt="ИИ-сводка и отзывы о преподавателе" y={55} />
        </Tile>
        <Tile
          layout="split"
          variant="default"
          title="Устройства"
          text="Веб-версия, агент автозаписи и MCP-сервер подключаются по QR-коду из приложения."
        >
          <VStack gap={2} className="la-devices">
            {devices.map((device) => (
              <Card key={device.title} padding={3} variant="muted">
                <HStack gap={3} vAlign="center">
                  <IconChip icon={<device.icon size={20} />} hue={device.hue} />
                  <VStack gap={0}>
                    <Link
                      href={device.href}
                      isStandalone
                      weight="semibold"
                      isExternalLink={device.isExternal}
                    >
                      {device.title}
                    </Link>
                    <Text type="supporting" color="secondary">
                      {device.text}
                    </Text>
                  </VStack>
                </HStack>
              </Card>
            ))}
          </VStack>
        </Tile>
      </div>
    </section>
  );
}

const facts: { icon: LucideIcon; hue: Hue; title: string; text: string }[] = [
  {
    icon: KeyRound,
    hue: 'blue',
    title: 'Пароль не нужен',
    text: 'Вход на официальной странице ITMO.ID. Пароль приложение не видит.',
  },
  {
    icon: Smartphone,
    hue: 'purple',
    title: 'Данные — на телефоне',
    text: 'Расписание, зачётка и пропуск загружаются с сайтов университета прямо на телефон.',
  },
  {
    icon: ServerCog,
    hue: 'green',
    title: 'Сервер — по выбору',
    text: 'Друзья, очереди на спорт, отзывы и устройства работают через сервер и включаются отдельно.',
  },
  {
    icon: CircleOff,
    hue: 'pink',
    title: 'Без рекламы',
    text: 'Рекламы и сторонней аналитики нет. Аккаунт на сервере можно удалить.',
  },
];

function Trust() {
  return (
    <section id="privacy" className="site-wrap la-section">
      <SectionHead title="Ваши данные остаются вашими" />
      <div className="la-facts">
        {facts.map((fact) => (
          <Card key={fact.title} padding={5}>
            <div className="la-fact">
              <IconChip icon={<fact.icon size={20} />} hue={fact.hue} />
              <VStack gap={1}>
                <Heading level={3} weight="bold">
                  {fact.title}
                </Heading>
                <Text color="secondary" textWrap="pretty">
                  {fact.text}
                </Text>
              </VStack>
            </div>
          </Card>
        ))}
      </div>
      <HStack gap={5} wrap="wrap" className="la-section-links">
        <Link href={PRIVACY} isStandalone hasUnderline>
          Политика конфиденциальности
        </Link>
        <Link href={DELETE_ACCOUNT} isStandalone hasUnderline>
          Как удалить аккаунт
        </Link>
      </HStack>
    </section>
  );
}

function PlatformCard({
  icon,
  hue,
  title,
  requirement,
  text,
  children,
}: {
  icon: ReactNode;
  hue: Hue;
  title: string;
  requirement: string;
  text: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padding={6} className="la-platform">
      <VStack gap={4} className="la-platform-body">
        <HStack gap={3} vAlign="center">
          <IconChip icon={icon} hue={hue} />
          <VStack gap={0}>
            <Heading level={3} weight="bold">
              {title}
            </Heading>
            <Text type="supporting" color="secondary">
              {requirement}
            </Text>
          </VStack>
        </HStack>
        <Text color="secondary" textWrap="pretty">
          {text}
        </Text>
      </VStack>
      <VStack gap={2}>{children}</VStack>
    </Card>
  );
}

function DownloadSection() {
  return (
    <section id="download" className="site-wrap la-section">
      <SectionHead
        title="Скачать"
        lead={
          IS_IN_GOOGLE_PLAY
            ? 'Версия 2.3. Android — в Google Play и файлом APK, iPhone — файлом .ipa из релиза на GitHub.'
            : 'Версия 2.3. Сборки для Android и iPhone выходят в релизах на GitHub.'
        }
      />
      <div className="la-platforms">
        <PlatformCard
          icon={<BrandIcon brand="android" size={20} />}
          hue="green"
          title="Android"
          requirement="Android 8.0 и новее"
          text={
            <>
              {IS_IN_GOOGLE_PLAY
                ? 'Проще всего поставить из\u00A0Google Play: обновления придут сами. '
                : null}
              APK из&nbsp;релиза на&nbsp;GitHub: arm64 подходит почти всем телефонам, armv7&nbsp;—
              совсем старым.
              {IS_IN_GOOGLE_PLAY
                ? ' Версии из\u00A0Google Play и\u00A0с\u00A0GitHub ставятся друг поверх друга.'
                : ' В\u00A0Google Play приложения пока нет, но скоро будет: закрытое тестирование уже идёт.'}
            </>
          }
        >
          {IS_IN_GOOGLE_PLAY ? (
            <Button
              label="Google Play"
              variant="primary"
              size="lg"
              icon={<BrandIcon brand="googleplay" size={18} />}
              href={GOOGLE_PLAY}
              target="_blank"
              rel="noreferrer"
            />
          ) : null}
          <Button
            label="Скачать APK на GitHub"
            variant={IS_IN_GOOGLE_PLAY ? 'secondary' : 'primary'}
            size="lg"
            icon={<BrandIcon brand="github" size={18} />}
            href={LATEST_RELEASE}
            target="_blank"
            rel="noreferrer"
          />
        </PlatformCard>
        <PlatformCard
          icon={<BrandIcon brand="apple" size={20} />}
          hue="pink"
          title="iPhone"
          requirement="iOS 26.1 и новее"
          text={
            <>
              В&nbsp;App Store приложения пока нет: скачайте файл .ipa из&nbsp;релиза
              и&nbsp;установите его через{' '}
              <Link href={ALTSTORE} hasUnderline>
                AltStore
              </Link>
              &nbsp;— пошаговая инструкция есть на&nbsp;его сайте. С&nbsp;SideStore
              и&nbsp;Sideloadly не&nbsp;работают виджеты. Уведомлений пока нет, а&nbsp;записывать
              на&nbsp;спорт при закрытом приложении умеет{' '}
              <Link href={AGENT} hasUnderline>
                itmo-widgets-agent
              </Link>
              .
            </>
          }
        >
          <Button
            label="Скачать .ipa на GitHub"
            variant="primary"
            size="lg"
            icon={<BrandIcon brand="github" size={18} />}
            href={LATEST_RELEASE}
            target="_blank"
            rel="noreferrer"
          />
        </PlatformCard>
        <PlatformCard
          icon={<Globe size={20} />}
          hue="blue"
          title="Веб-версия"
          requirement="Браузер и телефон с приложением"
          text={'Подключается по QR-коду в приложении: «Профиль\u00A0→\u00A0Устройства».'}
        >
          <Button
            label="Открыть веб-версию"
            variant="secondary"
            size="lg"
            icon={<Globe size={18} />}
            href={WEB_APP_LOGIN}
          />
        </PlatformCard>
      </div>
      <HStack gap={2} vAlign="center" className="la-section-links">
        <Link href={TELEGRAM} isStandalone hasUnderline target="_blank" rel="noreferrer">
          <BrandIcon className="site-brand-icon" brand="telegram" />
          Новости и анонсы — в Telegram-канале
        </Link>
      </HStack>
    </section>
  );
}

/** The landing: a short page with the features as a bento grid. */
export default function LandingPage() {
  return (
    <SitePage header="landing" className="la">
      <Hero />
      <Features />
      <Trust />
      <DownloadSection />
    </SitePage>
  );
}
