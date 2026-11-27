/** Addresses used by the public pages. Every one of them is a plain link: public pages have no router. */
export const TELEGRAM = 'https://t.me/itmowidgets';
export const GITHUB = 'https://github.com/alllexey-dev/ITMO.Widgets';
/** Android APKs and the iPhone .ipa are published as GitHub releases. */
export const RELEASES = `${GITHUB}/releases`;
export const LATEST_RELEASE = `${RELEASES}/latest`;
export const ISSUES = `${GITHUB}/issues`;
export const AGENT_GUIDE = `${GITHUB}/tree/master/selfhosted/agent`;
export const AGENT = 'https://github.com/alllexey-dev/itmo-widgets-agent';
export const MCP = 'https://github.com/alllexey-dev/itmo-mcp';
export const MCP_NPM = 'https://www.npmjs.com/package/itmo-mcp';
/** Installs an .ipa on an iPhone with working widgets; its site has a step-by-step guide. */
export const ALTSTORE = 'https://altstore.io';
export const EMAIL = 'alllexey.dev@gmail.com';

export const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=dev.alllexey.itmowidgets';
/** The App Store record of the iPhone app (`APP_STORE_ID` in the app's `Base.xcconfig`). */
export const APP_STORE = 'https://apps.apple.com/app/id6838850366';
/**
 * The iPhone app is not in the App Store yet, so the landing shows no App Store button and
 * TestFlight takes its place as the main iPhone button. `true` brings the App Store button back.
 */
export const IS_IN_APP_STORE: boolean = false;
/**
 * The app is published in Google Play since 2.3.0 (24 November 2026): the landing and the link
 * pages show the Play button. `false` hides it and brings back the "скоро" notes.
 */
export const IS_IN_GOOGLE_PLAY: boolean = true;

export const WEB_APP = '/app/';
export const WEB_APP_LOGIN = '/app/login';
export const PRIVACY = '/privacy.html';
export const DELETE_ACCOUNT = '/delete-account';

/**
 * The public TestFlight link of the iPhone beta. The landing shows a TestFlight button on the first
 * screen and in the iPhone card while it is set; an empty string hides both.
 */
export const TESTFLIGHT: string = 'https://testflight.apple.com/join/agWdPJgj';

/**
 * Live GitHub figures of the app repository, drawn by shields.io as images: public pages run no
 * scripts, and the CSP allows images from any HTTPS host. A badge has no label and a transparent
 * background, so the page draws the pill around it; the text is dark for the light scheme and
 * white for the dark one. If shields.io is down, the browser shows the image's alt text.
 */
const SHIELDS = 'https://img.shields.io/github';
const BADGE_STYLE = 'style=flat-square&label=';
export const BADGES = {
  stars: `${SHIELDS}/stars/alllexey-dev/ITMO.Widgets?${BADGE_STYLE}`,
  downloads: `${SHIELDS}/downloads/alllexey-dev/ITMO.Widgets/total?${BADGE_STYLE}`,
};
/** The badge background per scheme: transparent, with the text colour shields.io picks for it. */
export const BADGE_COLOR = {
  light: `&color=${encodeURIComponent('rgba(255,255,255,0)')}`,
  dark: `&color=${encodeURIComponent('rgba(0,0,0,0)')}`,
};

/** The two landing documents: Russian at the root, English under /en/ (`public/lang.js`). */
export const LANDING = { ru: '/', en: '/en/' } as const;
