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
/** Installs an .ipa on an iPhone with working widgets; its site has a step-by-step guide. */
export const ALTSTORE = 'https://altstore.io';
export const EMAIL = 'alllexey.dev@gmail.com';

export const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=dev.alllexey.itmowidgets';
/** The App Store record of the iPhone app (`APP_STORE_ID` in the app's `Base.xcconfig`). */
export const APP_STORE = 'https://apps.apple.com/app/id6838850366';
/**
 * The app is published in Google Play since 2.3.0 (24 November 2026): the landing and the link
 * pages show the Play button. `false` hides it and brings back the "скоро" notes.
 */
export const IS_IN_GOOGLE_PLAY: boolean = true;

export const WEB_APP = '/app/';
export const WEB_APP_LOGIN = '/app/login';
export const PRIVACY = '/privacy.html';
export const DELETE_ACCOUNT = '/delete-account';
