import { describe, expect, it } from 'vitest';
import { browserOf, clientHeader } from './clientHeader';

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE = `${CHROME} Edg/131.0.2903.70`;
const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const YANDEX = `${CHROME} YaBrowser/24.12.0.0 Safari/537.36`;

describe('client header', () => {
  it.each([
    [CHROME, 'chrome/131'],
    [EDGE, 'edge/131'],
    [SAFARI, 'safari/18'],
    [FIREFOX, 'firefox/133'],
    [YANDEX, 'yandex/24'],
    ['curl/8.0', 'other'],
  ])('names the browser of %s', (userAgent, browser) => {
    expect(browserOf(userAgent)).toBe(browser);
  });

  it('names the build by its commit and never sends the user agent', () => {
    const sha = '0123456789abcdef0123456789abcdef01234567';
    expect(clientHeader(CHROME, sha)).toBe(
      `kind=web; version=0123456; channel=web; commit=${sha}; browser=chrome/131`,
    );
  });

  it('marks a build without a commit as local', () => {
    expect(clientHeader(FIREFOX, 'local')).toBe(
      'kind=web; version=local; channel=web; browser=firefox/133',
    );
    expect(clientHeader(FIREFOX, undefined)).toBe(
      'kind=web; version=local; channel=web; browser=firefox/133',
    );
  });
});
