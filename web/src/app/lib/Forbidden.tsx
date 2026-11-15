import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Lock } from 'lucide-react';
import type { Access } from './router';

/** A section the user's roles do not open; no request is sent, the backend would answer 403 anyway. */
export function Forbidden({ access }: { access: Access }) {
  const who = access === 'admin' ? 'администратору' : 'модераторам';
  return (
    <EmptyState
      icon={<Lock size={32} />}
      title="Нет доступа"
      description={`Этот раздел доступен только ${who}.`}
      headingLevel={1}
      actions={<Button label="На главную" variant="secondary" href="/" />}
    />
  );
}
