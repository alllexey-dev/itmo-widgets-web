import { http, type RequestHandler } from 'msw';
import type { TeacherSummaryRow } from '../../features/reviews/types';
import type { ClientKindStats, Clients, ClientVersions } from '../../features/system/types';
import { credentialOf, daysAhead, minutesAgo } from '../admin';
import { reviewsBackend, summariesOf, summaryOf, syncOf, teacherRowOf } from '../reviews';
import { ok } from '../server';
import { appVersionOf, failedRunOf, sportRunOf, sportWeekOf, systemBackend } from '../system';
import { audited } from './admin';
import { STAFF } from './people';

// Demo answers of Система and Отзывы for `npm run dev:demo`; invented data only. The same paths feed
// Главная and Статистика, so the numbers are varied enough to read as statistics and agree with each
// other. Changes are kept in memory and written to the audit log of the users demo: a replaced key
// gets checked a few seconds later, and a started sync or recount ends by itself.

/** How long a demo run or a key check takes. */
const DEMO_RUN_MILLIS = 8000;

/** A repeatable number in `0..1` for an index, so the data does not jump between reloads. */
function noise(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

// ---------------------------------------------------------------- Система

const SOURCE = 'alllexey-dev/ITMO.Widgets';

const clientVersions: ClientVersions = {
  last7d: {
    activeDevices: 742,
    unknownDevices: 38,
    builds: [
      { platform: 'ANDROID', distribution: 'play', version: '2.2.1', build: 20210, devices: 318 },
      { platform: 'ANDROID', distribution: 'github', version: '2.2.1', build: 20210, devices: 147 },
      {
        platform: 'ANDROID',
        distribution: 'play',
        version: '2.3.0-beta.5',
        build: 20295,
        devices: 96,
      },
      {
        platform: 'ANDROID',
        distribution: 'github',
        version: '2.3.0-beta.5',
        build: 20295,
        devices: 61,
      },
      { platform: 'ANDROID', distribution: 'github', version: '2.2', build: 20200, devices: 34 },
      {
        platform: 'IOS',
        distribution: 'testflight',
        version: '2.3.0-beta.5',
        build: 41,
        devices: 27,
      },
      {
        platform: 'ANDROID',
        distribution: 'github',
        version: '2.3.0-beta.4',
        build: 20294,
        devices: 12,
      },
      { platform: 'ANDROID', distribution: 'sideload', version: '2.2.1', build: 20210, devices: 6 },
      {
        platform: 'ANDROID',
        distribution: 'dev',
        version: '2.3.0-beta.5',
        build: 20295,
        devices: 3,
      },
    ],
  },
  last30d: {
    activeDevices: 1034,
    unknownDevices: 121,
    builds: [
      { platform: 'ANDROID', distribution: 'play', version: '2.2.1', build: 20210, devices: 402 },
      { platform: 'ANDROID', distribution: 'github', version: '2.2.1', build: 20210, devices: 188 },
      {
        platform: 'ANDROID',
        distribution: 'play',
        version: '2.3.0-beta.5',
        build: 20295,
        devices: 104,
      },
      { platform: 'ANDROID', distribution: 'github', version: '2.2', build: 20200, devices: 79 },
      {
        platform: 'ANDROID',
        distribution: 'github',
        version: '2.3.0-beta.5',
        build: 20295,
        devices: 66,
      },
      {
        platform: 'IOS',
        distribution: 'testflight',
        version: '2.3.0-beta.5',
        build: 41,
        devices: 31,
      },
      {
        platform: 'ANDROID',
        distribution: 'github',
        version: '2.3.0-beta.4',
        build: 20294,
        devices: 24,
      },
      {
        platform: 'ANDROID',
        distribution: 'sideload',
        version: '2.2.1',
        build: 20210,
        devices: 11,
      },
      {
        platform: 'IOS',
        distribution: 'testflight',
        version: '2.3.0-beta.4',
        build: 38,
        devices: 5,
      },
      {
        platform: 'ANDROID',
        distribution: 'dev',
        version: '2.3.0-beta.5',
        build: 20295,
        devices: 3,
      },
    ],
  },
};

const clientKindSeeds: ClientKindStats[] = [
  {
    kind: 'ANDROID',
    active1d: 412,
    active7d: 689,
    active30d: 896,
    builds: [
      {
        custom: false,
        version: '2.2.1',
        channel: 'play',
        source: SOURCE,
        active7d: 318,
        active30d: 402,
      },
      {
        custom: false,
        version: '2.2.1',
        channel: 'github',
        source: SOURCE,
        active7d: 147,
        active30d: 188,
      },
      {
        custom: false,
        version: '2.3.0-beta.5',
        channel: 'play',
        source: SOURCE,
        active7d: 96,
        active30d: 104,
      },
      {
        custom: false,
        version: '2.3.0-beta.5',
        channel: 'github',
        source: SOURCE,
        active7d: 61,
        active30d: 66,
      },
      {
        custom: false,
        version: '2.2',
        channel: 'github',
        source: SOURCE,
        active7d: 34,
        active30d: 79,
      },
      {
        custom: true,
        version: '2.2.1',
        channel: 'custom',
        source: 'widgets-fork/ITMO.Widgets',
        active7d: 9,
        active30d: 14,
      },
      {
        custom: true,
        version: '2.3.0-beta.5',
        channel: 'dev',
        source: 'local',
        active7d: 3,
        active30d: 3,
      },
    ],
    platforms: [
      { name: '36', active30d: 301 },
      { name: '35', active30d: 286 },
      { name: '34', active30d: 172 },
      { name: '33', active30d: 81 },
      { name: '31', active30d: 37 },
      { name: null, active30d: 19 },
    ],
  },
  {
    kind: 'IOS',
    active1d: 14,
    active7d: 27,
    active30d: 36,
    builds: [
      {
        custom: false,
        version: '2.3.0-beta.5',
        channel: 'testflight',
        source: SOURCE,
        active7d: 27,
        active30d: 31,
      },
      {
        custom: false,
        version: '2.3.0-beta.4',
        channel: 'testflight',
        source: SOURCE,
        active7d: 0,
        active30d: 5,
      },
    ],
    platforms: [
      { name: '26', active30d: 29 },
      { name: '18', active30d: 7 },
    ],
  },
  {
    kind: 'WEB',
    active1d: 23,
    active7d: 88,
    active30d: 164,
    builds: [
      {
        custom: false,
        version: '9f3c2ab',
        channel: 'web',
        source: null,
        active7d: 88,
        active30d: 121,
      },
      {
        custom: false,
        version: '71d04e8',
        channel: 'web',
        source: null,
        active7d: 0,
        active30d: 43,
      },
    ],
    platforms: [
      { name: 'chrome/142', active30d: 74 },
      { name: 'yandex/25', active30d: 38 },
      { name: 'safari/26', active30d: 27 },
      { name: 'firefox/144', active30d: 16 },
      { name: 'edge/142', active30d: 9 },
    ],
  },
  {
    kind: 'AGENT',
    active1d: 6,
    active7d: 9,
    active30d: 12,
    builds: [
      {
        custom: false,
        version: '0.4.2',
        channel: 'github',
        source: 'alllexey-dev/itmo-widgets-agent',
        active7d: 7,
        active30d: 9,
      },
      {
        custom: true,
        version: '0.4.2',
        channel: 'custom',
        source: 'local',
        active7d: 2,
        active30d: 3,
      },
    ],
    platforms: [
      { name: 'linux-amd64', active30d: 7 },
      { name: 'linux-arm64', active30d: 3 },
      { name: 'darwin-arm64', active30d: 2 },
    ],
  },
  {
    kind: 'MCP',
    active1d: 3,
    active7d: 8,
    active30d: 17,
    builds: [
      {
        custom: false,
        version: '0.2.0',
        channel: 'github',
        source: 'alllexey-dev/itmo-mcp',
        active7d: 8,
        active30d: 17,
      },
    ],
    platforms: [
      { name: 'darwin-arm64', active30d: 9 },
      { name: 'linux-amd64', active30d: 5 },
      { name: 'windows-amd64', active30d: 3 },
    ],
  },
];

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** How many nightly totals of the clients Backend keeps. */
const HISTORY_DAYS = 90;

/**
 * One line of the client history: a version of a kind, official or custom, over every channel.
 * `today` is how many of its 7-day clients came in the last day.
 */
const clientSeries = clientKindSeeds.flatMap((stats) => {
  const lines = new Map<string, { version: string; custom: boolean; d7: number; d30: number }>();
  for (const build of stats.builds) {
    const key = `${build.version}|${build.custom}`;
    const line = lines.get(key) ?? { version: build.version, custom: build.custom, d7: 0, d30: 0 };
    lines.set(key, { ...line, d7: line.d7 + build.active7d, d30: line.d30 + build.active30d });
  }
  return [...lines.values()].map((line, order) => ({
    ...line,
    kind: stats.kind,
    today: Math.round(line.d7 * (0.5 + 0.15 * noise(order + stats.builds.length))),
  }));
});

/**
 * A kind as Backend answers it: the builds by their 30-day count, and totals that are the sums of
 * the builds, so the figures of a kind, its builds and its platforms agree.
 */
const clientKinds: ClientKindStats[] = clientKindSeeds.map((stats) => {
  const builds = [...stats.builds].sort((a, b) => b.active30d - a.active30d);
  const active30d = sum(builds.map((build) => build.active30d));
  const seeded = sum(stats.platforms.map((platform) => platform.active30d));
  const platforms = stats.platforms.map((platform) => ({
    ...platform,
    active30d: Math.floor((platform.active30d * active30d) / seeded),
  }));
  const [first] = platforms;
  if (first) first.active30d += active30d - sum(platforms.map((platform) => platform.active30d));
  return {
    kind: stats.kind,
    active1d: sum(
      clientSeries.filter((line) => line.kind === stats.kind).map((line) => line.today),
    ),
    active7d: sum(builds.map((build) => build.active7d)),
    active30d,
    builds,
    platforms,
  };
});

/**
 * The nightly totals Backend keeps, oldest first. The job writes the totals of the day before at
 * 00:20 Moscow time, so the history ends yesterday in Moscow and never has today. Every line grows
 * towards its rolling figure of now, and the latest total is a little below it.
 */
function clientHistory(): Clients['history'] {
  const DAY = 24 * 60 * 60_000;
  // Moscow is UTC+3, so its calendar day is the UTC day of three hours later.
  const moscowToday = Date.now() + 3 * 60 * 60_000;
  const last = HISTORY_DAYS - 1;
  return Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const day = new Date(moscowToday - (HISTORY_DAYS - index) * DAY).toISOString().slice(0, 10);
    const growth = 0.4 + (0.57 * index) / last;
    return clientSeries.map((line, order) => {
      const scale = index === last ? growth : growth * (0.92 + 0.16 * noise(index * 17 + order));
      const active30d = Math.floor(line.d30 * scale);
      const active7d = Math.min(active30d, Math.floor(line.d7 * scale));
      return {
        day,
        kind: line.kind,
        version: line.version,
        custom: line.custom,
        active30d,
        active7d,
        active1d: Math.min(active7d, Math.floor(line.today * scale)),
      };
    });
  }).flat();
}

/** The catalogue refresh runs every 15 minutes; a couple of the latest runs did not go through. */
const sportRuns = Array.from({ length: 12 }, (_, index) => {
  const run = { id: 4812 - index, timestamp: minutesAgo(4 + 15 * index) };
  if (index === 3) return failedRunOf(run);
  if (index === 7) {
    return sportRunOf({
      ...run,
      outcome: 'PARTIAL',
      durationMillis: 9400,
      receivedLessons: 388,
      updatedLessons: 6,
      skippedLessons: 24,
      errorCategory: 'HTTP',
    });
  }
  return sportRunOf({
    ...run,
    durationMillis: 3100 + Math.round(2400 * noise(index)),
    newLessonsAdded: index === 5 ? 18 : 0,
    updatedLessons: Math.round(9 * noise(index + 40)),
  });
});

const system = systemBackend({
  admin: STAFF.anna,
  audited,
  versions: {
    ANDROID: appVersionOf({
      latest: '2.2.1',
      minimum: '2.1',
      note: 'Исправили расписание на главном экране и добавили напоминания о записи на спорт.',
      overridden: true,
      updatedAt: minutesAgo(60 * 24 * 9),
    }),
    IOS: appVersionOf({ latest: '2.3.0', minimum: '2.3.0' }),
  },
  sport: sportWeekOf({
    lastSuccessAt: minutesAgo(4),
    outcomes7d: { SUCCESS: 655, PARTIAL: 11, FAILED: 6 },
    errors7d: { AUTH: 2, NETWORK: 9, HTTP: 5, MAPPING: 1, PERSISTENCE: 0, INTERNAL: 0 },
    averageDurationMillis7d: 4300,
    activeAutoSignEntries: 23,
    activeFreeSignEntries: 58,
    runs: sportRuns,
  }),
  credentials: [
    credentialOf('MY_ITMO_REFRESH_TOKEN', {
      kind: 'REFRESH_TOKEN',
      expiresAt: daysAhead(21),
      lastUsedAt: minutesAgo(4),
      lastRenewedAt: minutesAgo(4),
      updatedAt: minutesAgo(4),
    }),
    credentialOf('MY_ITMO_ACCESS_TOKEN', {
      kind: 'ACCESS_TOKEN',
      replaceable: false,
      expiresAt: minutesAgo(-26),
      lastUsedAt: minutesAgo(1),
      lastRenewedAt: minutesAgo(4),
      updatedAt: minutesAgo(4),
    }),
    credentialOf('MY_ITMO_ID_TOKEN', {
      kind: 'ID_TOKEN',
      replaceable: false,
      expiresAt: minutesAgo(-26),
      lastUsedAt: minutesAgo(4),
      lastRenewedAt: minutesAgo(4),
      updatedAt: minutesAgo(4),
    }),
    credentialOf('ISU_KEYCLOAK_IDENTITY', {
      expiresAt: daysAhead(9),
      expiresSoon: true,
      lastUsedAt: minutesAgo(190),
      lastRenewedAt: minutesAgo(60 * 7),
      updatedAt: minutesAgo(60 * 24 * 21),
      updatedSource: 'ADMIN',
      updatedByIsu: STAFF.anna.isu,
      updatedByName: STAFF.anna.name,
    }),
    credentialOf('GEMINI_API_KEY', {
      kind: 'API_KEY',
      lastUsedAt: minutesAgo(60 * 11),
      updatedAt: minutesAgo(60 * 24 * 48),
      updatedSource: 'SEED',
    }),
  ],
  clientVersions,
  clients: { kinds: clientKinds, history: clientHistory() },
});

/**
 * A replaced key is used a few seconds later, so the table shows the check arriving by itself. The
 * first use does what Backend does: a new refresh token is rotated together with its access and ID
 * tokens, the cookie logs in (its expiry stays unknown until a login rotates it), the Gemini key
 * answers a summary request.
 */
function checkReplacedKeys() {
  const isChecked = (key: string) =>
    system.state.credentials.some(
      (credential) =>
        credential.key === key &&
        credential.status === 'UNKNOWN' &&
        Date.now() - Date.parse(credential.updatedAt) > DEMO_RUN_MILLIS,
    );
  const now = new Date().toISOString();
  const isRotated = isChecked('MY_ITMO_REFRESH_TOKEN');
  system.state.credentials = system.state.credentials.map((credential) => {
    if (isRotated && credential.key.startsWith('MY_ITMO_')) {
      const isRefresh = credential.key === 'MY_ITMO_REFRESH_TOKEN';
      return {
        ...credential,
        present: true,
        status: 'OK' as const,
        expiresAt: isRefresh ? daysAhead(30) : minutesAgo(-30),
        lastUsedAt: now,
        lastRenewedAt: now,
        updatedAt: now,
        updatedSource: 'ROTATION' as const,
        updatedByIsu: null,
        updatedByName: null,
      };
    }
    if (!isChecked(credential.key)) return credential;
    return {
      ...credential,
      status: 'OK' as const,
      lastUsedAt: now,
      lastRenewedAt: credential.key === 'ISU_KEYCLOAK_IDENTITY' ? now : credential.lastRenewedAt,
    };
  });
}

// ---------------------------------------------------------------- Отзывы

const TEACHERS = [
  'Кузнецов Сергей Андреевич',
  'Белова Ольга Викторовна',
  'Литвинов Павел Игоревич',
  'Ахмедова Диана Рустамовна',
  'Орехов Михаил Юрьевич',
  'Савельева Татьяна Николаевна',
  'Гордеев Артём Олегович',
  'Мельникова Елена Сергеевна',
  'Третьяков Иван Павлович',
  'Зимина Наталья Алексеевна',
  'Рябов Константин Дмитриевич',
  'Котова Вера Михайловна',
  'Широков Денис Валерьевич',
  'Ларина Анастасия Петровна',
  'Быков Григорий Семёнович',
  'Фомина Ирина Владимировна',
  'Ершов Тимофей Романович',
  'Клименко Юлия Андреевна',
  'Носков Виктор Ильич',
  'Панова Светлана Геннадьевна',
  'Дроздов Леонид Аркадьевич',
  'Суханова Марина Олеговна',
  'Веселов Николай Борисович',
  'Юдина Полина Евгеньевна',
  'Агапов Роман Витальевич',
  'Шубина Дарья Константиновна',
  'Маслов Эдуард Тимурович',
  'Гусева Алина Максимовна',
  'Корнилов Фёдор Степанович',
  'Назарова Лидия Павловна',
  'Тихонов Глеб Анатольевич',
  'Власова Кира Денисовна',
  'Родионов Станислав Игнатьевич',
  'Жукова Оксана Леонидовна',
  'Прохоров Валентин Захарович',
  'Соболева Эльвира Маратовна',
  'Калашников Борис Ефимович',
  'Миронова Софья Артёмовна',
  'Лаптев Всеволод Кириллович',
  'Горбунова Регина Альбертовна',
  'Субботин Ярослав Георгиевич',
  'Абрамова Нина Фёдоровна',
  'Кириллов Матвей Русланович',
];

const DESCRIPTIONS = [
  'Студенты пишут, что лекции понятные, а лабораторные принимают строго. Чаще всего хвалят ответы на вопросы и подробные разборы задач.',
  'В отзывах отмечают интересные занятия и гибкие дедлайны. Претензии в основном к объёму домашних заданий в конце семестра.',
  'Мнения расходятся: одним нравится темп и требовательность, другим не хватает объяснений и обратной связи по работам.',
  'Отзывы в основном критические: материал читается по слайдам, требования к защите меняются, ответы на письма приходят поздно.',
];

const VARIANTS = [
  {
    level: 'VERY_POSITIVE',
    confidence: 'HIGH',
    tags: ['CLEAR_REQUIREMENTS', 'INTERESTING_CLASSES', 'QUICK_REPLIES', 'AUTOMAT'],
    pros: [
      'Понятно объясняет сложные темы',
      'Быстро отвечает на вопросы',
      'Можно получить автомат',
    ],
    cons: ['Много материала на одну лекцию'],
  },
  {
    level: 'POSITIVE',
    confidence: 'MEDIUM',
    tags: ['FLEXIBLE_DEADLINES', 'HEAVY_HOMEWORK', 'BONUS_POINTS'],
    pros: ['Гибкие дедлайны', 'Дополнительные баллы за активность'],
    cons: ['Много домашних заданий', 'Проверка работ затягивается'],
  },
  {
    level: 'MIXED',
    confidence: 'MEDIUM',
    tags: ['STRICT_DEFENSE', 'ASKS_THEORY', 'ATTENDANCE_REQUIRED'],
    pros: ['Глубоко знает предмет'],
    cons: ['Строгая защита лабораторных', 'Спрашивает теорию без предупреждения'],
  },
  {
    level: 'NEGATIVE',
    confidence: 'LOW',
    tags: ['READS_SLIDES', 'UNCLEAR_REQUIREMENTS', 'HARD_TO_REACH', 'HARD_EXAM'],
    pros: ['Материалы выкладываются заранее'],
    cons: ['Читает по слайдам', 'Размытые требования к работам', 'Сложно связаться'],
  },
] as const;

/** The latest moment the clock of Moscow (UTC+3) showed this time: when a nightly job last ran. */
function lastMoscowTime(hour: number, minute: number): Date {
  const now = new Date();
  const time = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour - 3, minute),
  );
  if (time > now) time.setUTCDate(time.getUTCDate() - 1);
  return time;
}

// The copy of the reviews is checked at 05:00 and the summaries are built at 05:30, Moscow time.
const syncedAt = lastMoscowTime(5, 0).toISOString();
const summarizedAt = lastMoscowTime(5, 30);

function teacherOf(name: string, index: number): TeacherSummaryRow {
  const row = { teacherIsu: 150200 + index * 37, teacherName: name };
  const count = 4 + Math.round(38 * noise(index + 3));
  const variant = VARIANTS[index % VARIANTS.length] ?? VARIANTS[0];
  const summary = summaryOf({
    reviewCount: count,
    description: DESCRIPTIONS[index % DESCRIPTIONS.length],
    pros: [...variant.pros],
    cons: [...variant.cons],
    tags: [...variant.tags],
    level: variant.level,
    confidence: variant.confidence,
    // Built by one of the latest nightly runs, a few seconds apart.
    generatedAt: new Date(
      summarizedAt.getTime() - (index % 6) * 24 * 60 * 60_000 + (index % 40) * 9000,
    ).toISOString(),
  });
  if (index % 37 === 5) {
    return teacherRowOf({
      ...row,
      status: 'FAILED',
      inputCount: count,
      reviewCount: null,
      summary: null,
      attempts: 3,
      lastAttemptAt: new Date(summarizedAt.getTime() + 4 * 60_000).toISOString(),
      lastError: index % 2 ? 'SCHEMA scales' : 'SAFETY blocked',
    });
  }
  if (index % 9 === 4) {
    return teacherRowOf({
      ...row,
      status: 'PENDING',
      inputCount: count + 2,
      reviewCount: count,
      summary: index % 2 ? summary : null,
    });
  }
  if (index % 50 === 7) {
    return teacherRowOf({
      ...row,
      status: 'HIDDEN',
      inputCount: count,
      reviewCount: count,
      summary,
      hidden: true,
      hiddenAt: minutesAgo(60 * 24 * 3),
      hiddenByName: STAFF.anna.name,
    });
  }
  return teacherRowOf({ ...row, inputCount: count, reviewCount: count, summary });
}

/** How many teachers have enough reviews for a summary: the rest of the 347 have fewer than three. */
const SUMMARIZED = 150;

/**
 * The names of the teachers: the list above, then its surnames with the first names and patronymics
 * of other entries of the same gender.
 */
function teacherNames(): string[] {
  const parts = TEACHERS.map((name) => name.split(' '));
  const isWoman = ([, , patronymic = '']: string[]) => patronymic.endsWith('на');
  const women = parts.filter(isWoman);
  const men = parts.filter((name) => !isWoman(name));
  return Array.from({ length: SUMMARIZED }, (_, index) => {
    const own = TEACHERS[index];
    if (own) return own;
    const pool = index % 2 ? women : men;
    const at = (step: number) => pool[(index * step + 3) % pool.length] ?? [];
    return [at(1)[0], at(5)[1], at(7)[2]].join(' ');
  });
}

/** Several pages; the last teachers have no name yet and too few reviews for a summary. */
const rows = [
  ...teacherNames().map(teacherOf),
  teacherRowOf({
    teacherIsu: 157900,
    teacherName: null,
    status: 'PENDING',
    inputCount: 2,
    reviewCount: null,
    summary: null,
  }),
  teacherRowOf({
    teacherIsu: 157937,
    teacherName: null,
    status: 'PENDING',
    inputCount: 5,
    reviewCount: null,
    summary: null,
  }),
];

const reviews = reviewsBackend({
  adminName: STAFF.anna.name,
  audited,
  sync: syncOf({
    lastCheckedAt: syncedAt,
    lastSuccessAt: syncedAt,
    lastChangedAt: syncedAt,
    lastAdded: 14,
    reviewsTotal: 1412,
    reviewsRemoved: 21,
  }),
  verification: { pending: 46, verified: 1187, unverified: 158 },
  summaries: summariesOf({
    model: 'gemini-2.5-flash-lite',
    lastStartedAt: summarizedAt.toISOString(),
    lastFinishedAt: new Date(summarizedAt.getTime() + 6 * 60_000).toISOString(),
    lastGenerated: 17,
    lastFailed: 2,
    lastRequests: 23,
    // The budget day is a Pacific day.
    budgetDay: new Date(Date.now() - 8 * 60 * 60_000).toISOString().slice(0, 10),
    budgetUsed: 23,
  }),
  rows,
});

/**
 * The AI state as the page reads it: the counters are the counts of the table, so hiding a summary
 * moves them, and the key state follows the keys table of Система.
 */
function summariesState() {
  const count = (status: TeacherSummaryRow['status']) =>
    reviews.state.rows.filter((row) => row.status === status).length;
  const key = system.state.credentials.find((credential) => credential.key === 'GEMINI_API_KEY');
  return {
    ...reviews.state.summaries,
    keyStatus: key?.status ?? 'MISSING',
    ready: count('READY'),
    pending: count('PENDING'),
    failed: count('FAILED'),
    hidden: count('HIDDEN'),
  };
}

/** A started sync or recount ends by itself a few seconds later. */
function finishRuns() {
  const isOver = (since: string | null) =>
    since !== null && Date.now() - Date.parse(since) > DEMO_RUN_MILLIS;
  const now = new Date().toISOString();
  if (reviews.state.sync.running && isOver(reviews.state.sync.runningSince)) {
    reviews.finishSync({ lastCheckedAt: now, lastSuccessAt: now, lastOutcome: 'UNCHANGED' });
  }
  if (reviews.state.summaries.running && isOver(reviews.state.summaries.runningSince)) {
    reviews.finishRun({
      lastFinishedAt: now,
      lastOutcome: 'COMPLETED',
      lastGenerated: 4,
      lastFailed: 0,
      lastRequests: 4,
      budgetUsed: reviews.state.summaries.budgetUsed + 4,
    });
  }
}

/** Moves the demo clock on a request and lets the handlers after it answer. */
const tick = (path: string, advance: () => void) =>
  http.all(path, () => {
    advance();
    return undefined;
  });

export const handlers: RequestHandler[] = [
  tick('*/api/admin/system/credentials', checkReplacedKeys),
  tick('*/api/admin/reviews/*', finishRuns),
  http.get('*/api/admin/reviews/summaries', () => ok(summariesState())),
  ...system.handlers,
  ...reviews.handlers,
];
