import { HStack } from '@astryxdesign/core/Stack';
import { Token } from '@astryxdesign/core/Token';
import type { Role } from '../../lib/session';
import { ROLES } from './labels';

/** The user's roles as tokens, the administrator first; nothing for a user without roles. */
export function RoleTokens({ roles }: { roles: readonly Role[] }) {
  const shown = ROLES.filter(({ role }) => roles.includes(role));
  if (shown.length === 0) return null;
  return (
    <HStack gap={1} wrap="wrap">
      {shown.map(({ role, label, icon: RoleIcon }) => (
        <Token
          key={role}
          size="sm"
          color={role === 'ADMIN' ? 'purple' : 'blue'}
          icon={<RoleIcon size={14} />}
          label={label}
        />
      ))}
    </HStack>
  );
}
