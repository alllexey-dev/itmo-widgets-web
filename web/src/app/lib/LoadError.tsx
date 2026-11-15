import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Text } from '@astryxdesign/core/Text';
import { CircleAlert, Lock } from 'lucide-react';
import { ApiError } from '../api/client';
import { errorText } from '../api/errors';
import './cabinet.css';

interface Props {
  error: unknown;
  /** What did not load: "Не удалось загрузить список". */
  title: string;
  onRetry: () => void;
  /** The small variant for a card or a panel. */
  isCompact?: boolean;
  /**
   * One row instead of a block: for a source that failed inside a row of a list, a row of tiles or
   * a small card, where a block would be taller than what it stands for.
   */
  isInline?: boolean;
}

/** The error state of loaded data. A 403 here is the page's access error: the session stays. */
export function LoadError({ error, title, onRetry, isCompact, isInline }: Props) {
  const isForbidden = error instanceof ApiError && error.isForbidden;
  if (isInline) {
    const Icon = isForbidden ? Lock : CircleAlert;
    return (
      <div className="load-error-inline" data-forbidden={isForbidden}>
        <Icon size={18} />
        <span className="load-error-inline-text">
          <Text weight="medium">{isForbidden ? 'Нет доступа' : title}</Text>
          <Text type="supporting" color="secondary">
            {isForbidden ? 'Недостаточно прав' : errorText(error, 'Попробуйте ещё раз')}
          </Text>
        </span>
        {isForbidden ? null : (
          <Button label="Повторить" variant="secondary" size="sm" onClick={onRetry} />
        )}
      </div>
    );
  }
  if (isForbidden) {
    return (
      <EmptyState
        icon={<Lock size={32} />}
        title="Нет доступа"
        description="Недостаточно прав, чтобы открыть эти данные."
        isCompact={isCompact}
      />
    );
  }
  return (
    <EmptyState
      icon={<CircleAlert size={32} />}
      title={title}
      description={errorText(error, 'Попробуйте ещё раз')}
      actions={<Button label="Повторить" variant="secondary" onClick={onRetry} />}
      isCompact={isCompact}
    />
  );
}
