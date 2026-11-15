import { HStack } from '@astryxdesign/core/Stack';
import { Token } from '@astryxdesign/core/Token';
import { Ban } from 'lucide-react';
import { counted } from '../../lib/format';
import type { Role } from '../../lib/session';
import { RoleTokens } from './RoleTokens';

interface Props {
  roles: readonly Role[];
  /** The user's restrictions in force now. */
  activeRestrictions: number;
}

/**
 * What an administrator should see before anything else about a user: the roles and what limits
 * the user now. The same marks stand in a row of the list and next to the name on the card.
 */
export function UserMarks({ roles, activeRestrictions }: Props) {
  if (roles.length === 0 && activeRestrictions === 0) return null;
  return (
    <HStack gap={1} vAlign="center" wrap="wrap">
      <RoleTokens roles={roles} />
      {activeRestrictions > 0 ? (
        <Token
          size="sm"
          color="orange"
          icon={<Ban size={14} />}
          label={counted(activeRestrictions, ['ограничение', 'ограничения', 'ограничений'])}
        />
      ) : null}
    </HStack>
  );
}
