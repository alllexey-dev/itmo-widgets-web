import type { Lang } from '../site/i18n';

/**
 * Every string of the landing in both languages. The page itself has no text of its own, so a
 * new string needs both entries and the type checker says when one is missing. A no-break
 * space (U+00A0) keeps a short word with the next one; UI typography (dashes, «», arrows) is allowed here.
 */
export interface LandingCopy {
  hero: {
    token: string;
    title: string;
    pitch: string;
    otherWays: string;
    testflight: string;
    stars: string;
    starsTitle: string;
    downloadsTitle: string;
    telegram: string;
    note: string;
    platformLegend: string;
  };
  shots: {
    qr: string;
    sportMine: string;
    homeHero: string;
    home: string;
    widgets: string;
    lesson: string;
    recordbook: string;
    sport: string;
    friends: string;
    teacher: string;
  };
  features: {
    title: string;
    today: [string, string];
    qr: [string, string];
    schedule: [string, string];
    recordbook: [string, string];
    sport: [string, string];
    friends: [string, string];
    reviews: [string, string];
    open: [string, string];
    repoText: string;
    starsTitle: string;
    channel: string;
    channelText: string;
  };
  tools: {
    title: string;
    lead: string;
    beta: string;
    agent: {
      tagline: string;
      audience: string;
      points: string[];
      setup: string;
      link: string;
    };
    mcp: {
      tagline: string;
      audience: string;
      points: string[];
      setup: string;
      link: string;
    };
    web: string;
    webLink: string;
  };
  privacy: {
    title: string;
    facts: { title: string; text: string }[];
    policy: string;
    deletion: string;
  };
  download: {
    title: string;
    lead: string;
    android: string;
    androidNote: string;
    apk: string;
    iphone: string;
    iphoneTestflight: string;
    /** The text around the AltStore link. */
    iphoneIpa: [before: string, after: string];
    ipa: string;
  };
}

const ru: LandingCopy = {
  hero: {
    token: 'Для студентов ИТМО · Android и iPhone',
    title: 'My ITMO, который вы заслужили',
    pitch:
      'Расписание, QR-пропуск, зачётка и спорт в одном приложении. Ближайшая пара видна прямо на главном экране, в виджете.',
    otherWays: 'Другие способы',
    testflight: 'TestFlight',
    stars: 'GitHub',
    starsTitle: 'Звёзды на GitHub',
    downloadsTitle: 'Скачивания с GitHub',
    telegram: 'Канал в Telegram',
    note: 'Неофициальное приложение. Вход через ITMO.ID, пароль приложение не видит.',
    platformLegend: 'Скриншоты с платформы',
  },
  shots: {
    qr: 'Пропуск: QR-код, имя, группа и ИСУ',
    sportMine: 'Спорт: баллы за семестр и записи',
    homeHero: 'Сегодня: пара, на которую идти, и день на линии времени',
    home: 'Сегодня: текущая пара, аудитория и время до конца',
    widgets: 'Виджеты «Расписание на день» и «Список пар»',
    lesson: 'Карточка пары: аудитория, маршрут и друзья на паре',
    recordbook: 'Зачётка: баллы и их источники',
    sport: 'Запись на спорт: поиск, фильтры и свободные места',
    friends: 'Чьё расписание: где сейчас друзья',
    teacher: 'ИИ-сводка и отзывы о преподавателе',
  },
  features: {
    title: 'Что внутри',
    today: [
      'Сегодня и виджеты',
      'Ближайшая пара, аудитория и сколько осталось до конца. В приложении и на главном экране.',
    ],
    qr: ['QR-пропуск', 'Открывается в одно касание. Последний код работает и без сети.'],
    schedule: [
      'Расписание и маршрут',
      'Дорога до аудитории на карте кампуса. Если расписание поменяется, приложение скажет.',
    ],
    recordbook: [
      'Зачётка и баллы',
      'Баллы из БАРС, My ITMO и таблиц преподавателей в одном месте. Новая оценка приходит уведомлением.',
    ],
    sport: [
      'Спорт и автозапись',
      'Очередь ловит освободившееся место, а автозапись сама записывает на занятие каждые две недели.',
    ],
    friends: ['Друзья', 'Видно, где сейчас друзья и какие пары у вас общие.'],
    reviews: [
      'Отзывы о преподавателях',
      'Отзывы студентов, по умолчанию анонимные, и короткая ИИ-сводка по ним.',
    ],
    open: [
      'Открытый код',
      'Приложение лежит на GitHub под MIT, там же релизы и issues. Новости выходят в Telegram-канале.',
    ],
    repoText: 'Код и релизы',
    starsTitle: 'Звёзды на GitHub',
    channel: '@itmowidgets',
    channelText: 'Новости и анонсы',
  },
  tools: {
    title: 'Агент и MCP-сервер',
    lead: 'Две необязательные программы для вашего компьютера или сервера. Подключаются к приложению по QR-коду: «Профиль → Устройства → Подключить устройство».',
    beta: 'бета',
    agent: {
      tagline: 'Автозапись на спорт без участия телефона',
      audience:
        'Для тех, кто стоит в очередях на физкультуру и держит включённым ноутбук, NAS или сервер.',
      points: [
        'Сервер сообщает о свободном месте, агент перепроверяет очередь и записывает вас. Телефону для этого не нужно быть в сети.',
        'На iPhone с .ipa из релиза пушей нет, и записывать при закрытом приложении там умеет только агент.',
        'Токен ИТМО хранится только на вашей машине. К ИТМО агент ходит не чаще 60 раз в час.',
      ],
      setup:
        'Linux, macOS, Windows, FreeBSD или Docker, ставится одной командой. Пока это бета, доступ включаю по запросу: напишите в Telegram.',
      link: 'Установка на GitHub',
    },
    mcp: {
      tagline: 'My ITMO и БАРС для ИИ-ассистентов',
      audience: 'Для тех, кто работает с Claude, Codex, Cursor или другим MCP-клиентом.',
      points: [
        'Ассистент сам смотрит расписание, зачётку, баллы БАРС, физкультуру, стипендию и общежитие. Спрашивайте как обычно: «какие пары завтра?»',
        'Через приложение ITMO.Widgets ему видны ещё отзывы о преподавателях, ссылки предметов и ваши очереди на спорт.',
        'По умолчанию только читает. Запись на спорт, брони аудиторий и заявки включаются отдельно, и каждое действие ждёт вашего подтверждения.',
      ],
      setup: 'Нужен Node.js 20 или новее.',
      link: 'itmo-mcp на GitHub',
    },
    web: 'Ещё есть веб-версия, но пока в ней немного: друзья, спорт и устройства.',
    webLink: 'Открыть веб-версию',
  },
  privacy: {
    title: 'Что с данными',
    facts: [
      {
        title: 'Пароль не нужен',
        text: 'Вы входите на официальной странице ITMO.ID. Пароль приложение не видит.',
      },
      {
        title: 'Данные на телефоне',
        text: 'Расписание, зачётка и пропуск грузятся с сайтов университета прямо на телефон.',
      },
      {
        title: 'Сервер, если нужен',
        text: 'Друзья, очереди на спорт, отзывы и устройства работают через сервер ITMO.Widgets. Он выключен, пока вы сами его не включите.',
      },
      {
        title: 'Без рекламы',
        text: 'Рекламы и сторонней аналитики нет. Аккаунт на сервере можно удалить.',
      },
    ],
    policy: 'Политика конфиденциальности',
    deletion: 'Как удалить аккаунт',
  },
  download: {
    title: 'Скачать',
    lead: 'Ставьте из Google Play или App Store, обновления придут сами. Если магазин не подходит, рядом с кнопками есть APK и .ipa.',
    android: 'Android 8.0 и новее',
    androidNote:
      'Если Play нет, возьмите APK в релизах на GitHub: arm64 подходит почти всем телефонам, armv7 нужен совсем старым. Версии из Play и с GitHub ставятся друг поверх друга.',
    apk: 'APK на GitHub',
    iphone: 'iOS 26.1 и новее',
    iphoneTestflight: 'Бета-версии выходят в TestFlight.',
    iphoneIpa: [
      'Есть и файл .ipa в релизах на GitHub, его ставят через ',
      '. Пушей в такой сборке нет, а с SideStore и Sideloadly не работают виджеты.',
    ],
    ipa: '.ipa на GitHub',
  },
};

const en: LandingCopy = {
  hero: {
    token: 'For ITMO students · Android and iPhone',
    title: 'The My ITMO you deserve',
    pitch:
      'Schedule, QR pass, record book and sport in one app. Your next class is right on the home screen, in a widget.',
    otherWays: 'Other ways',
    testflight: 'TestFlight',
    stars: 'GitHub',
    starsTitle: 'Stars on GitHub',
    downloadsTitle: 'Downloads from GitHub',
    telegram: 'Telegram channel',
    note: 'Unofficial app, in Russian. You sign in through ITMO.ID, and the app never sees your password.',
    platformLegend: 'Screenshots from',
  },
  shots: {
    qr: 'Pass: QR code, name, group and ISU number',
    sportMine: 'Sport: points this term and sign-ups',
    homeHero: 'Today: the class to go to and the day on a timeline',
    home: 'Today: the current class, its room and time until it ends',
    widgets: 'Day schedule and class list widgets',
    lesson: 'Class card: room, route and friends in the class',
    recordbook: 'Record book: points and where they come from',
    sport: 'Sport sign-up: search, filters and free spots',
    friends: 'Whose schedule: where friends are right now',
    teacher: 'AI summary and reviews of a teacher',
  },
  features: {
    title: 'What’s inside',
    today: [
      'Today and widgets',
      'Your next class, its room and how long until it ends, in the app and on the home screen.',
    ],
    qr: ['QR pass', 'Opens with one tap. The last code works offline too.'],
    schedule: [
      'Schedule and route',
      'The campus map shows the way to your room. If the schedule changes, the app tells you.',
    ],
    recordbook: [
      'Record book and points',
      'Points from BARS, My ITMO and teachers’ spreadsheets in one place. A new grade arrives as a notification.',
    ],
    sport: [
      'Sport and auto sign-up',
      'A queue grabs a spot when one frees up, and auto sign-up books the same class every two weeks.',
    ],
    friends: ['Friends', 'See where your friends are right now and which classes you share.'],
    reviews: [
      'Teacher reviews',
      'Student reviews, anonymous by default, with a short AI summary of them.',
    ],
    open: [
      'Open source',
      'The app is on GitHub under the MIT license, with releases and issues. News goes to the Telegram channel.',
    ],
    repoText: 'Code and releases',
    starsTitle: 'Stars on GitHub',
    channel: '@itmowidgets',
    channelText: 'News and announcements',
  },
  tools: {
    title: 'Agent and MCP server',
    lead: 'Two optional programs for your own computer or server. Both connect to the app with a QR code from “Профиль → Устройства → Подключить устройство” (Profile → Devices → Connect a device).',
    beta: 'beta',
    agent: {
      tagline: 'Sport auto sign-up that runs without your phone',
      audience:
        'For students who queue for PE classes and have a laptop, NAS or server that stays on.',
      points: [
        'The server reports a free spot, the agent rechecks your queue and books you. Your phone does not have to be online for that.',
        'An iPhone with the .ipa from a release gets no push notifications, so only the agent can book there while the app is closed.',
        'Your ITMO token stays on your machine. The agent makes at most 60 requests an hour to ITMO.',
      ],
      setup:
        'Linux, macOS, Windows, FreeBSD or Docker, installed with one command. It is in beta for now: message me in Telegram and I’ll turn on access.',
      link: 'Install guide on GitHub',
    },
    mcp: {
      tagline: 'My ITMO and BARS for AI assistants',
      audience: 'For people who use Claude, Codex, Cursor or another MCP client.',
      points: [
        'Your assistant reads your schedule, record book, BARS points, PE, scholarship and dorm on its own. Just ask, for example “what classes do I have tomorrow?”',
        'Through the ITMO.Widgets app it also sees teacher reviews, subject links and your sport queues.',
        'Read-only by default. Sport sign-ups, room bookings and requests are turned on separately, and every action waits for your confirmation.',
      ],
      setup: 'Needs Node.js 20 or newer.',
      link: 'itmo-mcp on GitHub',
    },
    web: 'There is also a web version, though it has little in it so far: friends, sport and devices.',
    webLink: 'Open the web version',
  },
  privacy: {
    title: 'What happens to your data',
    facts: [
      {
        title: 'No password needed',
        text: 'You sign in on the official ITMO.ID page. The app never sees your password.',
      },
      {
        title: 'Data stays on the phone',
        text: 'Schedule, record book and pass load from university sites straight to your phone.',
      },
      {
        title: 'Server only if you want it',
        text: 'Friends, sport queues, reviews and devices go through the ITMO.Widgets server. It stays off until you turn it on.',
      },
      {
        title: 'No ads',
        text: 'No ads and no third-party analytics. You can delete your server account.',
      },
    ],
    policy: 'Privacy policy (in Russian)',
    deletion: 'How to delete your account (in Russian)',
  },
  download: {
    title: 'Download',
    lead: 'Install from Google Play or the App Store, and updates arrive on their own. If a store does not suit you, the APK and the .ipa are next to the buttons. The app is in Russian.',
    android: 'Android 8.0 or newer',
    androidNote:
      'No Play on your phone? Take the APK from GitHub releases: arm64 fits almost every phone, armv7 is for very old ones. Play and GitHub builds install over each other.',
    apk: 'APK on GitHub',
    iphone: 'iOS 26.1 or newer',
    iphoneTestflight: 'Beta builds come out in TestFlight.',
    iphoneIpa: [
      'There is also an .ipa file in GitHub releases that you install with ',
      '. That build gets no push notifications, and widgets do not work with SideStore or Sideloadly.',
    ],
    ipa: '.ipa on GitHub',
  },
};

export const landingCopy: Record<Lang, LandingCopy> = { ru, en };
