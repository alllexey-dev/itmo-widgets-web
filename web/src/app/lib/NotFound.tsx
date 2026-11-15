import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { SearchX } from 'lucide-react';

/** An address the cabinet does not know, shown inside the shell. */
export function NotFound() {
  return (
    <EmptyState
      icon={<SearchX size={32} />}
      title="Не найдено"
      description="Проверьте адрес или вернитесь на главную."
      headingLevel={1}
      actions={<Button label="На главную" variant="secondary" href="/" />}
    />
  );
}
