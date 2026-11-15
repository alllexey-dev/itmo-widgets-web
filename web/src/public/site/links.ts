/** Addresses used by the public pages. Every one of them is a plain link: public pages have no router. */
export const TELEGRAM = 'https://t.me/itmowidgets';
export const GITHUB = 'https://github.com/alllexey-dev/ITMO.Widgets';
/** Android and iPhone builds, betas included, are published as GitHub releases. */
export const RELEASES = `${GITHUB}/releases`;
export const LATEST_RELEASE = `${RELEASES}/latest`;
export const ISSUES = `${GITHUB}/issues`;
export const AGENT_GUIDE = `${GITHUB}/tree/master/selfhosted/agent`;
export const AGENT = 'https://github.com/alllexey-dev/itmo-widgets-agent';
export const MCP = 'https://github.com/alllexey-dev/itmo-mcp';
/** Tools that install an .ipa on an iPhone; each site has its own step-by-step guide. */
export const ALTSTORE = 'https://altstore.io';
export const SIDESTORE = 'https://sidestore.io';
export const SIDELOADLY = 'https://sideloadly.io';
export const EMAIL = 'alllexey.dev@gmail.com';

export const GOOGLE_PLAY = 'https://play.google.com/store/apps/details?id=dev.alllexey.itmowidgets';
/**
 * The app is in closed testing in Google Play and not published yet, so no page shows a Play
 * button. Set this to `true` once it is published: the landing and the link pages then show the
 * button and drop the "скоро" notes.
 */
export const IS_IN_GOOGLE_PLAY: boolean = false;

export const WEB_APP = '/app/';
export const WEB_APP_LOGIN = '/app/login';
export const PRIVACY = '/privacy.html';
export const DELETE_ACCOUNT = '/delete-account';
