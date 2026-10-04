import { createHash } from 'node:crypto';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { AdminPage, LinkStatus } from '../api/admin';
import type { ApiEnvelope } from '../api/client';
import type { components } from '../api/schema';
import source from '../api/openapi.source?raw';
import snapshot from '../api/openapi.json?raw';
import type { Role, Session } from '../features/auth/session';
import type { DashboardTotals } from '../features/dashboard/types';
import type { CaseTarget, DecisionRequest } from '../features/moderation/types';
import type { TeacherSummary } from '../features/reviews/types';
import type {
  AppVersionRequest,
  SportErrorCategory,
  SportOutcome,
  SportStatus,
} from '../features/system/types';

type Schemas = components['schemas'];

describe('generated API aliases', () => {
  it('keeps the immutable Backend snapshot at the recorded source digest', () => {
    expect(source).toMatch(
      /^repo=alllexey-dev\/itmo-widgets-backend\ncommit=[0-9a-f]{40}\npath=docs\/openapi.json\nsha256=[0-9a-f]{64}\n$/,
    );
    const digest = createHash('sha256').update(snapshot).digest('hex');
    expect(source).toContain(`sha256=${digest}\n`);
  });

  it('keeps the envelope and generic page wire metadata', () => {
    expectTypeOf<ApiEnvelope<Session>['error']>().toEqualTypeOf<
      (Omit<Schemas['ErrorDetails'], 'code'> & { code: string | null }) | null
    >();
    expectTypeOf<AdminPage<Session>['items']>().toEqualTypeOf<Session[]>();
    expectTypeOf<Omit<AdminPage<Session>, 'items'>>().toEqualTypeOf<
      Omit<Schemas['AdminPageAdminUserItem'], 'items'>
    >();
  });

  it('keeps label maps exhaustive and roles closed despite loose string schemas', () => {
    expectTypeOf<Role>().toEqualTypeOf<'MODERATOR' | 'ADMIN'>();
    expectTypeOf<DashboardTotals['links']>().toEqualTypeOf<Record<LinkStatus, number>>();
    expectTypeOf<SportStatus['outcomes7d']>().toEqualTypeOf<Record<SportOutcome, number>>();
    expectTypeOf<SportStatus['errors7d']>().toEqualTypeOf<Record<SportErrorCategory, number>>();
    expectTypeOf<AppVersionRequest['note']>().toEqualTypeOf<string>();
  });

  it('preserves moderation discriminants and the request response restriction split', () => {
    expectTypeOf<Schemas['SportQueueEntry']['type']>().toEqualTypeOf<'free' | 'auto'>();
    expectTypeOf<Schemas['SportQueue']['type']>().toEqualTypeOf<'free' | 'auto'>();
    expectTypeOf<CaseTarget['targetType']>().toEqualTypeOf<'SUBJECT_RESOURCE' | 'TEACHER_REVIEW'>();
    expectTypeOf<DecisionRequest>().toExtend<Schemas['ModerationDecisionRequest']>();
    expectTypeOf<Schemas['DecisionRestriction']['days']>().toEqualTypeOf<number | null>();
    expectTypeOf<NonNullable<DecisionRequest['restriction']>['days']>().toEqualTypeOf<
      number | undefined
    >();
  });

  it('allows old releases to omit new capabilities and accepts unknown summary tags', () => {
    expectTypeOf<CaseTarget['author']['capabilities']>().toEqualTypeOf<
      Schemas['UserCapabilities'] | undefined
    >();
    expectTypeOf<TeacherSummary['tags']>().toEqualTypeOf<string[]>();
  });
});
