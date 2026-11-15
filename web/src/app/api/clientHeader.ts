/**
 * The `X-Client` header every request carries (ITMO.Widgets ADR 0034, Backend `docs/contracts/clients.md`): the
 * web build and the browser family with its major version, never the raw user agent.
 */

const UNSAFE = /[^A-Za-z0-9._/+-]/g;

function value(raw: string): string {
  return raw.replace(UNSAFE, '').slice(0, 64);
}

/** `chrome/131`, `safari/18`, `firefox/133`, `edge/131`, `opera/115`, `yandex/24` or `other`. */
export function browserOf(userAgent: string): string {
  const rules: [string, RegExp][] = [
    ['edge', /Edg(?:A|iOS)?\/(\d+)/],
    ['opera', /OPR\/(\d+)/],
    ['yandex', /YaBrowser\/(\d+)/],
    ['firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['safari', /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari\//],
  ];
  for (const [family, pattern] of rules) {
    const major = pattern.exec(userAgent)?.[1];
    if (major) return `${family}/${major}`;
  }
  return 'other';
}

function commitOf(revision: string | undefined): string | undefined {
  return revision && /^[0-9a-f]{7,40}$/.test(revision) ? revision : undefined;
}

/** The web build: the short commit the image was built from (`REVISION`), `local` for other builds. */
export function webVersion(revision: string | undefined): string {
  return commitOf(revision)?.slice(0, 7) ?? 'local';
}

/** [revision] is the git commit the image was built from (`REVISION`). */
export function clientHeader(userAgent: string, revision: string | undefined): string {
  const commit = commitOf(revision);
  const pairs: [string, string | undefined][] = [
    ['kind', 'web'],
    ['version', webVersion(revision)],
    ['channel', 'web'],
    ['commit', commit],
    ['browser', browserOf(userAgent)],
  ];
  return pairs
    .map(([key, raw]) => [key, raw === undefined ? '' : value(raw)] as const)
    .filter(([, safe]) => safe !== '')
    .map(([key, safe]) => `${key}=${safe}`)
    .join('; ');
}
