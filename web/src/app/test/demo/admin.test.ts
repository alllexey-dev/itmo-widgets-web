import { getResponse, type RequestHandler } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { AuditEntry, AuditPage } from '../../features/audit/types';
import type { TeacherPage } from '../../features/reviews/types';
import type {
  AppVersion,
  ModerationSettings,
  ServiceCredential,
  SportSettings,
} from '../../features/system/types';
import type { AdminUserDetail, UsersPage } from '../../features/users/types';

// The audit log of the demo against the demo itself. Its history is written by hand in `admin.ts`
// and has to agree with what the other areas start with, and it must stay as it is whatever the
// visitor changes. The handlers are asked directly, without a server.

const MINUTE = 60_000;

/** A demo with its starting state: the state lives in the modules, so they are loaded anew. */
async function freshDemo() {
  vi.resetModules();
  const { handlers } = (await import('./index')) as { handlers: RequestHandler[] };

  async function ask<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await getResponse(
      handlers,
      new Request(`http://localhost${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Web-Request': '1' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
    if (!response?.ok)
      throw new Error(`${method} ${path} answered ${response?.status ?? 'nothing'}`);
    return ((await response.json()) as { data: T }).data;
  }

  const get = <T>(path: string) => ask<T>('GET', path);
  const put = <T>(path: string, body: unknown) => ask<T>('PUT', path, body);
  const log = async () => (await get<AuditPage>('/api/admin/audit?page=0&size=500')).items;

  /** What the visitor of the second review did on Система: the limit, the minimum version, a key. */
  async function changeSettings() {
    await put('/api/admin/system/sport/settings', { autoSignLimit: 8 });
    const version = await get<AppVersion>('/api/admin/system/app-version?platform=ANDROID');
    await put('/api/admin/system/app-version?platform=ANDROID', {
      latest: version.latest,
      minimum: version.latest,
      note: version.note,
    });
    await put('/api/admin/system/credentials/ISU_KEYCLOAK_IDENTITY', {
      value: 'demo-cookie-value-0123456789',
    });
  }

  return { get, put, log, changeSettings };
}

/** An entry without what differs between two loads of the demo: its id and the exact moment. */
const told = ({ action, target, details, actorIsu }: AuditEntry) => ({
  action,
  target,
  details,
  actorIsu,
});

const timeOf = (entry: AuditEntry) => Date.parse(entry.createdAt);

/** The newest entry of [entries] (newest first) that [matches]. */
function latest(entries: AuditEntry[], matches: (entry: AuditEntry) => boolean) {
  return entries.find(matches);
}

/** The value a change line ends with: `latest 2.2 -> 2.2.1` gives `2.2.1` for the key `latest`. */
function valueOf(entry: AuditEntry | undefined, key: string): string | undefined {
  for (const line of (entry?.details ?? '').replace(/^IOS: /, '').split('; ')) {
    const [, name, value] = /^(\S+) .* -> (.*)$/.exec(line) ?? [];
    if (name === key) return value;
  }
  return undefined;
}

describe('the audit log of the demo', () => {
  it('puts each change on top once and leaves the history below as it was', async () => {
    const demo = await freshDemo();
    const before = await demo.log();

    await demo.changeSettings();

    const after = await demo.log();
    expect(after.slice(0, 3).map((entry) => [entry.action, entry.target, entry.details])).toEqual([
      ['SERVICE_CREDENTIAL_REPLACED', 'credential:ISU_KEYCLOAK_IDENTITY', null],
      ['APP_VERSION_CHANGED', 'app-version', 'minimum 2.1 -> 2.2.1'],
      ['SPORT_SETTINGS_CHANGED', 'sport-settings', 'autoSignLimit 10 -> 8'],
    ]);
    expect(after.slice(3)).toEqual(before);
  });

  it('shows the same history when it is first opened after the changes', async () => {
    const untouched = await (await freshDemo()).log();
    const demo = await freshDemo();

    await demo.changeSettings();

    const opened = await demo.log();
    expect(opened).toHaveLength(untouched.length + 3);
    expect(opened.slice(3).map(told)).toEqual(untouched.map(told));
  });

  it('is newest first, the changes of the visitor included', async () => {
    const demo = await freshDemo();
    await demo.changeSettings();
    await demo.put('/api/admin/users/400005/agent-access', { enabled: true });

    const times = (await demo.log()).map(timeOf);

    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(new Set((await demo.log()).map((entry) => entry.id)).size).toBe(times.length);
  });

  it('ends at the version, the limit and the keys Система starts with', async () => {
    const demo = await freshDemo();
    const log = await demo.log();

    for (const platform of ['ANDROID', 'IOS'] as const) {
      const form = await demo.get<AppVersion>(`/api/admin/system/app-version?platform=${platform}`);
      const ofPlatform = (entry: AuditEntry) =>
        entry.action === 'APP_VERSION_CHANGED' &&
        (entry.details ?? '').startsWith('IOS: ') === (platform === 'IOS');
      const saved = latest(log, ofPlatform);
      if (!form.overridden || !form.updatedAt) {
        expect(saved, `${platform} was never saved`).toBeUndefined();
        continue;
      }
      expect(Math.abs(timeOf(saved as AuditEntry) - Date.parse(form.updatedAt))).toBeLessThan(
        MINUTE,
      );
      const changed = (key: string) =>
        valueOf(
          latest(log, (entry) => ofPlatform(entry) && valueOf(entry, key) !== undefined),
          key,
        );
      expect(changed('latest')).toBe(form.latest);
      expect(changed('minimum')).toBe(form.minimum);
    }

    const limit = await demo.get<SportSettings>('/api/admin/system/sport/settings');
    const limited = latest(log, (entry) => entry.action === 'SPORT_SETTINGS_CHANGED');
    if (limit.overridden)
      expect(valueOf(limited, 'autoSignLimit')).toBe(String(limit.autoSignLimit));
    else expect(limited).toBeUndefined();

    const keys = await demo.get<ServiceCredential[]>('/api/admin/system/credentials');
    for (const credential of keys) {
      const replaced = latest(log, (entry) => entry.target === `credential:${credential.key}`);
      if (credential.updatedSource !== 'ADMIN') {
        expect(replaced, `${credential.key} was not replaced by hand`).toBeUndefined();
        continue;
      }
      expect(replaced?.actorIsu).toBe(credential.updatedByIsu);
      expect(
        Math.abs(timeOf(replaced as AuditEntry) - Date.parse(credential.updatedAt)),
      ).toBeLessThan(MINUTE);
    }
  });

  it('ends at the rules of moderation Система starts with', async () => {
    const demo = await freshDemo();
    const log = await demo.log();
    const settings = await demo.get<ModerationSettings>('/api/admin/moderation/settings');
    const fields = {
      premoderation: 'premoderation',
      report_threshold: 'reportThreshold',
      vote_threshold: 'voteThreshold',
      daily_submission_limit: 'dailySubmissionLimit',
      daily_report_limit: 'dailyReportLimit',
    } as const;

    let checked = 0;
    for (const [type, policy] of Object.entries(settings.policies)) {
      for (const [written, field] of Object.entries(fields)) {
        const key = `${type}.${written}`;
        const changed = latest(
          log,
          (entry) =>
            entry.action === 'MODERATION_SETTINGS_CHANGED' && valueOf(entry, key) !== undefined,
        );
        if (!changed) continue;
        expect(valueOf(changed, key), key).toBe(String(policy[field]));
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('hides the summaries Отзывы starts with hidden, and no other', async () => {
    const demo = await freshDemo();
    const log = await demo.log();
    const hidden = await demo.get<TeacherPage>(
      '/api/admin/reviews/summaries/teachers?status=HIDDEN&size=100',
    );

    const teachers = new Set(
      log.filter((entry) => entry.action.startsWith('AI_SUMMARY_')).map((entry) => entry.target),
    );
    const hiddenInLog = [...teachers].filter(
      (target) =>
        latest(log, (entry) => entry.target === target && /_(HIDDEN|SHOWN)$/.test(entry.action))
          ?.action === 'AI_SUMMARY_HIDDEN',
    );

    expect(hiddenInLog.sort()).toEqual(
      hidden.items.map((row) => `teacher:${row.teacherIsu}`).sort(),
    );
    for (const row of hidden.items) {
      const entry = latest(log, (item) => item.target === `teacher:${row.teacherIsu}`);
      expect(Math.abs(timeOf(entry as AuditEntry) - Date.parse(row.hiddenAt ?? ''))).toBeLessThan(
        MINUTE,
      );
    }
    // A summary the log asks to recount or shows again exists and is not hidden.
    const all = await demo.get<TeacherPage>('/api/admin/reviews/summaries/teachers?size=500');
    const known = new Set(all.items.map((row) => `teacher:${row.teacherIsu}`));
    for (const target of teachers) expect(known, target).toContain(target);
  });

  it('grants the roles and the agent access the cards show, to people who had registered', async () => {
    const demo = await freshDemo();
    const log = await demo.log();
    const about = (isu: number, kind: 'ROLE' | 'AGENT_ACCESS') =>
      latest(log, (entry) => entry.target === `user:${isu}` && entry.action.startsWith(kind));

    const named = new Set(
      log.flatMap((entry) => /^user:(\d+)$/.exec(entry.target)?.[1] ?? []).map(Number),
    );
    for (const isu of named) {
      const card = await demo.get<AdminUserDetail>(`/api/admin/users/${isu}`);
      const role = about(isu, 'ROLE');
      if (role)
        expect(card.roles.includes('MODERATOR'), `role of ${isu}`).toBe(
          role.action === 'ROLE_GRANTED',
        );
      const access = about(isu, 'AGENT_ACCESS');
      if (access)
        expect(card.agentAccess, `agents of ${isu}`).toBe(access.action === 'AGENT_ACCESS_GRANTED');
      for (const entry of log.filter((item) => item.target === `user:${isu}`)) {
        expect(timeOf(entry), `${entry.action} of ${isu}`).toBeGreaterThan(
          Date.parse(card.createdAt),
        );
      }
    }

    // Nobody is a moderator without the log saying who made them one.
    for (let page = 0; ; page += 1) {
      const list = await demo.get<UsersPage>(`/api/admin/users?page=${page}&size=500`);
      for (const user of list.items) {
        if (user.roles.includes('MODERATOR')) {
          expect(about(user.isu, 'ROLE')?.action, `moderator ${user.isu}`).toBe('ROLE_GRANTED');
        }
      }
      if ((page + 1) * list.size >= list.total) break;
    }
  });
});
