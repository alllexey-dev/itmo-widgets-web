/**
 * Languages of the public pages. The landing exists in both (`/` and `/en/`); the policy,
 * account deletion and link pages are Russian only, so their frame is always Russian.
 */
export type Lang = 'ru' | 'en';

/** Strings of the shared frame: the header and the footer. */
export const frameCopy = {
  ru: {
    navLabel: 'Разделы сайта',
    features: 'Возможности',
    tools: 'Агент и MCP',
    privacy: 'Данные',
    download: 'Скачать',
    langLabel: 'Язык',
    footerLabel: 'Ссылки',
    privacyPolicy: 'Политика конфиденциальности',
    deleteAccount: 'Удаление аккаунта',
    issues: 'Сообщить о проблеме',
    unofficial: '© 2026 alllexey · Неофициальное приложение. Не связано с Университетом ИТМО.',
  },
  en: {
    navLabel: 'Site sections',
    features: 'Features',
    tools: 'Agent and MCP',
    privacy: 'Data',
    download: 'Download',
    langLabel: 'Language',
    footerLabel: 'Links',
    privacyPolicy: 'Privacy policy (in Russian)',
    deleteAccount: 'Account deletion (in Russian)',
    issues: 'Report a problem',
    unofficial: '© 2026 alllexey · Unofficial app, not affiliated with ITMO University.',
  },
} satisfies Record<Lang, Record<string, string>>;
