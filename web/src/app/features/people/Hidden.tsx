import { EmptyState } from '@astryxdesign/core/EmptyState';
import { EyeOff } from 'lucide-react';

/** The body of a card the person does not open to the visitor. */
export function Hidden({ title }: { title: string }) {
  return (
    <EmptyState
      icon={<EyeOff size={32} />}
      title={title}
      description="Так настроена приватность этого человека."
      headingLevel={3}
      isCompact
    />
  );
}
