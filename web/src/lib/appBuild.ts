// Names of the app builds devices report (Backend `AdminClientBuild`, `AdminDevice.app*`).

const CHANNELS: Record<string, string> = {
  github: 'GitHub',
  play: 'Google Play',
  appstore: 'App Store',
  dev: 'Отладочная сборка',
};

/** The distribution channel; a channel this web does not know yet shows as sent. */
export function channelLabel(distribution: string): string {
  return CHANNELS[distribution] ?? distribution;
}

/** "2.3.0-beta.1 (20291)". */
export function buildLabel(version: string, build: number | null | undefined): string {
  return build == null ? version : `${version} (${build})`;
}

/** A pre-release such as `2.3.0-beta.1` or `2.3.0-rc.2`: a version with a `-suffix`. */
export function isPrerelease(version: string): boolean {
  return version.includes('-');
}
