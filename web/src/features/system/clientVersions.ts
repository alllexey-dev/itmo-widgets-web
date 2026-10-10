import type { ClientBuild } from './types';

export interface VersionGroup {
  key: string;
  version: string;
  build: number;
  devices: number;
  channels: ClientBuild[];
}

const byDevices = <T extends { devices: number; build: number }>(a: T, b: T) =>
  b.devices - a.devices || b.build - a.build;

/** One row per version and build with its platforms and channels, most devices first. */
export function groupBuilds(builds: readonly ClientBuild[]): VersionGroup[] {
  const groups = new Map<string, VersionGroup>();
  for (const item of builds) {
    const key = `${item.version} (${item.build})`;
    const group = groups.get(key) ?? {
      key,
      version: item.version,
      build: item.build,
      devices: 0,
      channels: [],
    };
    group.devices += item.devices;
    group.channels.push(item);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, channels: group.channels.toSorted(byDevices) }))
    .sort(byDevices);
}
