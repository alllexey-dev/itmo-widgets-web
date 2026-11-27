import { Button } from '@astryxdesign/core/Button';
import { Card, type CardVariant } from '@astryxdesign/core/Card';
import { Code } from '@astryxdesign/core/Code';
import { Heading } from '@astryxdesign/core/Heading';
import { Link } from '@astryxdesign/core/Link';
import { HStack, VStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import {
  ArrowUpRight,
  Bot,
  CircleOff,
  Download,
  KeyRound,
  Server,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Star,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { BrandIcon } from '../../shared/BrandIcon';
import type { Lang } from '../site/i18n';
import {
  AGENT,
  ALTSTORE,
  APP_STORE,
  BADGE_COLOR,
  BADGES,
  DELETE_ACCOUNT,
  GITHUB,
  GOOGLE_PLAY,
  IS_IN_APP_STORE,
  IS_IN_GOOGLE_PLAY,
  LATEST_RELEASE,
  MCP,
  MCP_NPM,
  PRIVACY,
  TELEGRAM,
  TESTFLIGHT,
  WEB_APP_LOGIN,
} from '../site/links';
import { SitePage } from '../site/SitePage';
import { landingCopy, type LandingCopy } from './copy';

import './landing.css';

type Hue = 'blue' | 'pink' | 'yellow' | 'purple' | 'green';

/** Opens an outside address in a new tab without sending this page as the referrer. */
const external = { target: '_blank', rel: 'noreferrer' } as const;

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
function PlatformSwitch({ legend }: { legend: string }) {
  return (
    <fieldset className="la-switch">
      <legend className="la-switch-legend">{legend}</legend>
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

/**
 * A live figure of the app repository from shields.io (`BADGES`), in the text colour of the
 * system scheme. The alt text is empty: if shields.io is blocked the browser draws nothing
 * instead of a broken image, and the `title` of the figure still says what it counts.
 */
function Badge({ badge }: { badge: keyof typeof BADGES }) {
  return (
    <picture>
      <source srcSet={BADGES[badge] + BADGE_COLOR.dark} media="(prefers-color-scheme: dark)" />
      <img
        className="la-badge"
        src={BADGES[badge] + BADGE_COLOR.light}
        alt=""
        height={20}
        referrerPolicy="no-referrer"
      />
    </picture>
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

function GooglePlayButton() {
  return (
    <Button
      label="Google Play"
      size="lg"
      variant="primary"
      icon={<BrandIcon brand="googleplay" size={18} />}
      href={GOOGLE_PLAY}
      {...external}
    />
  );
}

/** Shown only while `IS_IN_APP_STORE` in `links.ts` is on. */
function AppStoreButton() {
  if (!IS_IN_APP_STORE) return null;
  return (
    <Button
      label="App Store"
      size="lg"
      variant="primary"
      icon={<BrandIcon brand="apple" size={18} />}
      href={APP_STORE}
      {...external}
    />
  );
}

/**
 * Shown only once `TESTFLIGHT` in `links.ts` holds the public beta link. Until the app is in the
 * App Store it is the main iPhone button.
 */
function TestFlightButton({ label }: { label: string }) {
  if (!TESTFLIGHT) return null;
  return (
    <Button
      label={label}
      size="lg"
      variant={IS_IN_APP_STORE ? 'secondary' : 'primary'}
      icon={<BrandIcon brand="apple" size={18} />}
      href={TESTFLIGHT}
      {...external}
    />
  );
}

/**
 * Pills under the hero buttons: the app repository with its stars and release downloads (the
 * downloads are GitHub's too, so they share its pill) and the Telegram channel.
 */
function Community({ copy }: { copy: LandingCopy['hero'] }) {
  return (
    <HStack gap={2} wrap="wrap" vAlign="center" className="la-community">
      <a className="la-pill" href={GITHUB} {...external}>
        <BrandIcon brand="github" size={16} />
        {copy.stars}
        <span className="la-pill-figure">
          <span className="la-pill-stat" title={copy.starsTitle}>
            <Star size={14} aria-hidden="true" />
            <Badge badge="stars" />
          </span>
          <span className="la-pill-stat" title={copy.downloadsTitle}>
            <Download size={14} aria-hidden="true" />
            <Badge badge="downloads" />
          </span>
        </span>
      </a>
      <a className="la-pill la-pill--telegram" href={TELEGRAM} {...external}>
        <BrandIcon brand="telegram" size={16} />
        {copy.telegram}
      </a>
    </HStack>
  );
}

function Hero({ copy, shots }: { copy: LandingCopy['hero']; shots: LandingCopy['shots'] }) {
  return (
    <section className="site-wrap la-hero">
      <VStack gap={5} className="la-hero-copy">
        <HStack>
          <Token label={copy.token} color="blue" />
        </HStack>
        <Heading
          level={1}
          type="display-1"
          weight="bold"
          textWrap="balance"
          className="la-hero-title"
        >
          {copy.title}
        </Heading>
        <Text size="xl" color="secondary" textWrap="pretty" className="la-hero-pitch">
          {copy.pitch}
        </Text>
        <HStack gap={2} wrap="wrap" vAlign="center">
          {IS_IN_GOOGLE_PLAY ? <GooglePlayButton /> : null}
          <AppStoreButton />
          <TestFlightButton label={copy.testflight} />
          <Link
            href="#download"
            isStandalone
            hasUnderline
            weight="semibold"
            className="la-other-ways"
          >
            {copy.otherWays}
          </Link>
        </HStack>
        <Community copy={copy} />
        <HStack gap={2} vAlign="start" className="la-hero-note">
          <ShieldCheck size={16} aria-hidden="true" />
          <Text type="supporting" color="secondary">
            {copy.note}
          </Text>
        </HStack>
      </VStack>

      <div className="la-showcase">
        <div className="la-stage">
          <Shapes />
          <Phone className="la-phone--left" name="qr" alt={shots.qr} />
          <Phone className="la-phone--right" name="sport-mine" alt={shots.sportMine} />
          <Phone className="la-phone--center" name="home" alt={shots.homeHero} />
        </div>
        <PlatformSwitch legend={copy.platformLegend} />
      </div>
    </section>
  );
}

interface TileProps {
  copy: [title: string, text: string];
  variant: CardVariant;
  /** `wide` spans two columns, `split` also puts the copy beside the visual. */
  layout?: 'single' | 'wide' | 'split';
  /** A tile without screenshots, which takes only the height of its content where it can. */
  isCompact?: boolean;
  children: ReactNode;
}

function Tile({
  copy: [title, text],
  variant,
  layout = 'single',
  isCompact = false,
  children,
}: TileProps) {
  const compact = isCompact ? ' la-tile--compact' : '';
  return (
    <Card variant={variant} padding={0} className={`la-tile la-tile--${layout}${compact}`}>
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

/**
 * A row of the open-source tile: the whole row is the link. An icon chip, the name with a line
 * under it, and a live figure at the end. A border, not a fill, marks the row, so it shows on the
 * card in both schemes.
 */
function LinkRow({
  icon,
  hue,
  href,
  title,
  text,
  figure,
}: {
  icon: ReactNode;
  hue: Hue;
  href: string;
  title: string;
  text: string;
  figure?: ReactNode;
}) {
  return (
    <a className="la-link-row" href={href} {...external}>
      <IconChip icon={icon} hue={hue} />
      <span className="la-link-row-copy">
        <span className="la-link-row-title">
          {title}
          <ArrowUpRight size={14} aria-hidden="true" />
        </span>
        <span className="la-link-row-text">
          {text}
          {figure}
        </span>
      </span>
    </a>
  );
}

function Features({ copy, shots }: { copy: LandingCopy['features']; shots: LandingCopy['shots'] }) {
  return (
    <section id="features" className="site-wrap la-section">
      <SectionHead title={copy.title} />
      <div className="la-bento">
        <Tile layout="wide" variant="blue" copy={copy.today}>
          <Shot name="home" alt={shots.home} />
          <Shot name="widgets" alt={shots.widgets} />
        </Tile>
        <Tile variant="pink" copy={copy.qr}>
          <Shot name="qr" alt={shots.qr} y={100} />
        </Tile>
        <Tile variant="yellow" copy={copy.schedule}>
          <Shot name="lesson" alt={shots.lesson} />
        </Tile>
        <Tile variant="purple" copy={copy.recordbook}>
          <Shot name="recordbook" alt={shots.recordbook} y={12} />
        </Tile>
        <Tile layout="wide" variant="green" copy={copy.sport}>
          <Shot name="sport" alt={shots.sport} y={8} />
          <Shot name="sport-mine" alt={shots.sportMine} y={8} />
        </Tile>
        <Tile variant="blue" copy={copy.friends}>
          <Shot name="friends" alt={shots.friends} y={4} iosY={70} />
        </Tile>
        <Tile layout="split" variant="yellow" copy={copy.reviews}>
          <Shot name="teacher" alt={shots.teacher} y={55} />
        </Tile>
        <Tile layout="wide" variant="default" copy={copy.open} isCompact>
          <div className="la-links">
            <LinkRow
              icon={<BrandIcon brand="github" size={20} />}
              hue="purple"
              href={GITHUB}
              title="ITMO.Widgets"
              text={copy.repoText}
              figure={
                <span className="la-pill-stat" title={copy.starsTitle}>
                  <Star size={14} aria-hidden="true" />
                  <Badge badge="stars" />
                </span>
              }
            />
            <LinkRow
              icon={<BrandIcon brand="telegram" size={20} />}
              hue="blue"
              href={TELEGRAM}
              title={copy.channel}
              text={copy.channelText}
            />
          </div>
        </Tile>
      </div>
    </section>
  );
}

function ToolCard({
  icon,
  hue,
  name,
  copy,
  extra,
  links,
}: {
  icon: LucideIcon;
  hue: Hue;
  name: string;
  copy: LandingCopy['tools']['agent'];
  extra?: ReactNode;
  links: ReactNode;
}) {
  const Icon = icon;
  return (
    <Card padding={6} className="la-tool">
      <VStack gap={4} className="la-tool-body">
        <HStack gap={3} vAlign="center">
          <IconChip icon={<Icon size={20} />} hue={hue} />
          <VStack gap={0}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Heading level={3} weight="bold">
                {name}
              </Heading>
            </HStack>
            <Text type="supporting" color="secondary">
              {copy.tagline}
            </Text>
          </VStack>
        </HStack>
        <Text weight="semibold" textWrap="pretty">
          {copy.audience}
        </Text>
        <ul className="la-points">
          {copy.points.map((point) => (
            <li key={point}>
              <Text color="secondary" textWrap="pretty">
                {point}
              </Text>
            </li>
          ))}
        </ul>
        {extra}
        <Text type="supporting" color="secondary" textWrap="pretty">
          {copy.setup}
        </Text>
      </VStack>
      <HStack gap={2} wrap="wrap" vAlign="center">
        {links}
      </HStack>
    </Card>
  );
}

function Tools({ copy }: { copy: LandingCopy['tools'] }) {
  return (
    <section id="tools" className="site-wrap la-section">
      <SectionHead title={copy.title} lead={copy.lead} />
      <div className="la-tools">
        <ToolCard
          icon={Server}
          hue="green"
          name="itmo-widgets-agent"
          copy={copy.agent}
          links={
            <Button
              label={copy.agent.link}
              variant="secondary"
              size="lg"
              icon={<BrandIcon brand="github" size={18} />}
              href={AGENT}
              {...external}
            />
          }
        />
        <ToolCard
          icon={Bot}
          hue="purple"
          name="itmo-mcp"
          copy={copy.mcp}
          extra={
            <div className="la-command">
              <Code>npx -y itmo-mcp setup</Code>
            </div>
          }
          links={
            <>
              <Button
                label={copy.mcp.link}
                variant="secondary"
                size="lg"
                icon={<BrandIcon brand="github" size={18} />}
                href={MCP}
                {...external}
              />
              <Button label="npm" variant="ghost" size="lg" href={MCP_NPM} {...external} />
            </>
          }
        />
      </div>
      <div className="la-section-links">
        <Text color="secondary" textWrap="pretty">
          {copy.web}{' '}
          <Link href={WEB_APP_LOGIN} hasUnderline>
            {copy.webLink}
          </Link>
        </Text>
      </div>
    </section>
  );
}

const factIcons: { icon: LucideIcon; hue: Hue }[] = [
  { icon: KeyRound, hue: 'blue' },
  { icon: Smartphone, hue: 'purple' },
  { icon: ServerCog, hue: 'green' },
  { icon: CircleOff, hue: 'pink' },
];

function Trust({ copy }: { copy: LandingCopy['privacy'] }) {
  return (
    <section id="privacy" className="site-wrap la-section">
      <SectionHead title={copy.title} />
      <div className="la-facts">
        {copy.facts.map((fact, index) => {
          const { icon: Icon, hue } = factIcons[index];
          return (
            <Card key={fact.title} padding={5}>
              <div className="la-fact">
                <IconChip icon={<Icon size={20} />} hue={hue} />
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
          );
        })}
      </div>
      <HStack gap={5} wrap="wrap" className="la-section-links">
        <Link href={PRIVACY} isStandalone hasUnderline>
          {copy.policy}
        </Link>
        <Link href={DELETE_ACCOUNT} isStandalone hasUnderline>
          {copy.deletion}
        </Link>
      </HStack>
    </section>
  );
}

/** A platform of the download section: the store button first, the fallback ways in small print. */
function PlatformCard({
  icon,
  hue,
  title,
  requirement,
  note,
  children,
}: {
  icon: ReactNode;
  hue: Hue;
  title: string;
  requirement: string;
  note: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padding={6} className="la-platform">
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
      <HStack gap={4} wrap="wrap" vAlign="center">
        {children}
      </HStack>
      <Text type="supporting" color="secondary" textWrap="pretty">
        {note}
      </Text>
    </Card>
  );
}

/** A quiet link to a GitHub release file, the fallback way to install. */
function ReleaseLink({ label }: { label: string }) {
  return (
    <Link href={LATEST_RELEASE} isStandalone hasUnderline {...external}>
      <BrandIcon className="site-brand-icon" brand="github" />
      {label}
    </Link>
  );
}

function DownloadSection({
  copy,
  hero,
}: {
  copy: LandingCopy['download'];
  hero: LandingCopy['hero'];
}) {
  return (
    <section id="download" className="site-wrap la-section">
      <SectionHead title={copy.title} lead={copy.lead} />
      <div className="la-platforms">
        <PlatformCard
          icon={<BrandIcon brand="android" size={20} />}
          hue="green"
          title="Android"
          requirement={copy.android}
          note={copy.androidNote}
        >
          {IS_IN_GOOGLE_PLAY ? <GooglePlayButton /> : null}
          <ReleaseLink label={copy.apk} />
        </PlatformCard>
        <PlatformCard
          icon={<BrandIcon brand="apple" size={20} />}
          hue="pink"
          title="iPhone"
          requirement={copy.iphone}
          note={
            <>
              {TESTFLIGHT
                ? `${IS_IN_APP_STORE ? copy.iphoneTestflight : copy.iphoneTestflightOnly} `
                : null}
              {copy.iphoneIpa[0]}
              <Link href={ALTSTORE} hasUnderline {...external}>
                AltStore
              </Link>
              {copy.iphoneIpa[1]}
            </>
          }
        >
          <AppStoreButton />
          <TestFlightButton label={hero.testflight} />
          <ReleaseLink label={copy.ipa} />
        </PlatformCard>
      </div>
    </section>
  );
}

/** The landing in one language; `/` is Russian, `/en/` English (`LandingPageEn`). */
export function Landing({ lang }: { lang: Lang }) {
  const copy = landingCopy[lang];
  return (
    <SitePage header="landing" lang={lang} className="la">
      <Hero copy={copy.hero} shots={copy.shots} />
      <Features copy={copy.features} shots={copy.shots} />
      <Tools copy={copy.tools} />
      <Trust copy={copy.privacy} />
      <DownloadSection copy={copy.download} hero={copy.hero} />
    </SitePage>
  );
}

export default function LandingPage() {
  return <Landing lang="ru" />;
}
