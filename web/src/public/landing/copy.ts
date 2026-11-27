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
    lead: 'Программы для своего компьютера или сервера. Подключаются по QR-коду: «Профиль → Устройства».',
    agent: {
      tagline: 'Автозапись на спорт без участия телефона',
      audience: 'Для тех, у кого есть всегда включённый ноутбук, NAS или сервер.',
      points: [
        'Записывает из очереди, как только освобождается место, даже если телефон не в сети.',
        'Токен ИТМО хранится только на вашей машине.',
      ],
      setup: 'Linux, macOS, Windows, FreeBSD или Docker.',
      link: 'Установка на GitHub',
    },
    mcp: {
      tagline: 'My ITMO и БАРС для ИИ-ассистентов',
      audience: 'Для Claude, Codex, Cursor и других MCP-клиентов.',
      points: [
        'Расписание, зачётка, баллы БАРС и физкультура по запросу вроде «какие пары завтра?»',
        'По умолчанию только читает. Любое изменение ждёт вашего подтверждения.',
      ],
      setup: 'Нужен Node.js 20 или новее.',
      link: 'itmo-mcp на GitHub',
    },
    web: 'Есть и веб-версия, но пока в ней немного.',
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
        text: 'Друзья, очереди и отзывы работают через сервер ITMO.Widgets. По умолчанию он выключен.',
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
    lead: 'Из магазина обновления придут сами.',
    android: 'Android 8.0 и новее',
    androidNote:
      'Нет Google Play? Есть APK: arm64 почти для всех телефонов, armv7 для совсем старых.',
    apk: 'APK на GitHub',
    iphone: 'iOS 26.1 и новее',
    iphoneTestflight: 'Бета-версии выходят в TestFlight.',
    iphoneIpa: ['Файл .ipa ставится через ', ', пушей в такой сборке нет.'],
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
    lead: 'Programs for your own computer or server. They connect with a QR code from “Профиль → Устройства” (Profile → Devices).',
    agent: {
      tagline: 'Sport auto sign-up without your phone',
      audience: 'For anyone with a laptop, NAS or server that stays on.',
      points: [
        'Books you from the queue as soon as a spot frees up, even when your phone is offline.',
        'Your ITMO token stays on your machine.',
      ],
      setup: 'Linux, macOS, Windows, FreeBSD or Docker.',
      link: 'Install guide on GitHub',
    },
    mcp: {
      tagline: 'My ITMO and BARS for AI assistants',
      audience: 'For Claude, Codex, Cursor and other MCP clients.',
      points: [
        'Schedule, record book, BARS points and PE on request, like “what classes do I have tomorrow?”',
        'Read-only by default. Any change waits for your confirmation.',
      ],
      setup: 'Needs Node.js 20 or newer.',
      link: 'itmo-mcp on GitHub',
    },
    web: 'There is also a web version, though not much is in it yet.',
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
        text: 'Friends, queues and reviews go through the ITMO.Widgets server. It is off by default.',
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
    lead: 'Updates come through the store. The app is in Russian.',
    android: 'Android 8.0 or newer',
    androidNote:
      'No Google Play? There is an APK: arm64 fits almost every phone, armv7 is for very old ones.',
    apk: 'APK on GitHub',
    iphone: 'iOS 26.1 or newer',
    iphoneTestflight: 'Beta builds come out in TestFlight.',
    iphoneIpa: ['The .ipa installs with ', ' and gets no push notifications.'],
    ipa: '.ipa on GitHub',
  },
};

export const landingCopy: Record<Lang, LandingCopy> = { ru, en };
