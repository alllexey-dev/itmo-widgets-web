import { Center } from '@astryxdesign/core/Center';
import { Spinner } from '@astryxdesign/core/Spinner';
import type { ReactNode } from 'react';
import './cabinet.css';
import type { Resource } from './data';
import { LoadError } from './LoadError';

interface Props<T> {
  resource: Resource<T>;
  /** The accessible name of the spinner: "Загружаем список". */
  label: string;
  /** The title of the error state: "Не удалось загрузить список". */
  errorTitle?: string;
  /** The small spinner and error state for a card or a panel. */
  isCompact?: boolean;
  /** The small spinner and a one-row error, for a source inside a row or a small card. */
  isInline?: boolean;
  /** Renders the data. The empty state is the page's: it knows what "nothing" means. */
  children: (data: T) => ReactNode;
}

/**
 * The states of one `Resource`: a spinner until the first data, the data under a soft overlay while
 * it is replaced, and `LoadError` with "Повторить" when nothing could be loaded.
 */
export function Loadable<T>({
  resource,
  label,
  errorTitle = 'Не удалось загрузить',
  isCompact,
  isInline,
  children,
}: Props<T>) {
  const { data, error, loading, reload } = resource;
  if (data !== undefined) {
    return (
      <div className="loadable" aria-busy={loading} data-loading={loading}>
        {children(data)}
      </div>
    );
  }
  if (error && !loading) {
    return (
      <LoadError
        error={error}
        title={errorTitle}
        onRetry={reload}
        isCompact={isCompact}
        isInline={isInline}
      />
    );
  }
  const isSmall = isCompact || isInline;
  return (
    <Center padding={isInline ? 1 : isCompact ? 4 : 10}>
      <Spinner size={isSmall ? 'md' : 'lg'} aria-label={label} />
    </Center>
  );
}
