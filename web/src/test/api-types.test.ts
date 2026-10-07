import { createHash } from 'node:crypto';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { ApiEnvelope } from '../api/client';
import source from '../api/openapi.source?raw';
import snapshot from '../api/openapi.json?raw';
import type { components } from '../api/schema';
import type { LoginStatus } from '../features/auth/login';
import type { Role, User } from '../lib/session.svelte';

type Schemas = components['schemas'];

describe('generated API aliases', () => {
  it('keeps the immutable Backend snapshot at the recorded source digest', () => {
    expect(source).toMatch(
      /^repo=alllexey-dev\/itmo-widgets-backend\ncommit=[0-9a-f]{40}\npath=docs\/openapi.json\nsha256=[0-9a-f]{64}\n$/,
    );
    const digest = createHash('sha256').update(snapshot).digest('hex');
    expect(source).toContain(`sha256=${digest}\n`);
  });

  it('keeps the envelope error open to codes of older releases', () => {
    expectTypeOf<ApiEnvelope<User>['error']>().toEqualTypeOf<
      (Omit<Schemas['ErrorDetails'], 'code'> & { code: string | null }) | null
    >();
  });

  it('keeps roles closed despite the loose string schema', () => {
    expectTypeOf<Role>().toEqualTypeOf<'MODERATOR' | 'ADMIN'>();
    expectTypeOf<User['roles']>().toEqualTypeOf<Role[]>();
    expectTypeOf<Omit<User, 'roles'>>().toEqualTypeOf<Omit<Schemas['WebMe'], 'roles'>>();
  });

  it('keeps the sign-in poll states', () => {
    expectTypeOf<LoginStatus>().toEqualTypeOf<'PENDING' | 'APPROVED' | 'EXPIRED'>();
  });
});
