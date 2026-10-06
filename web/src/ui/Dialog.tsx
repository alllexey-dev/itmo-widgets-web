import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import styles from './Dialog.module.css';
import { focusableIn, trapTab } from './focus';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { lockScroll } from './scrollLock';
import { Shape, type ShapeTone } from './Shape';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** A shaped icon above the title. */
  icon?: IconName;
  shape?: string;
  tone?: ShapeTone;
  children?: ReactNode;
  /** Buttons at the bottom, the main action last. */
  actions?: ReactNode;
  /** Receives focus on open; by default the first focusable element. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Scrim click and Esc close the dialog unless this is false (e.g. while saving). */
  dismissible?: boolean;
  size?: 'small' | 'medium' | 'large';
}

/** `m3-dialog` on `m3-scrim`; on phones the package turns it into a bottom sheet. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  shape = 'cookie9',
  tone = 'secondary',
  children,
  actions,
  initialFocusRef,
  dismissible = true,
  size = 'small',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
  });

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    (initialFocusRef?.current ?? focusableIn(panel)[0] ?? panel).focus();
    const unlock = lockScroll();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!dismissibleRef.current) return;
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      trapTab(event, panel);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      unlock();
      previous?.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  return createPortal(
    <div
      className="m3-scrim"
      role="presentation"
      onClick={() => {
        if (dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cx(
          'm3-dialog',
          size === 'large' && 'wide',
          size === 'medium' && styles.medium,
          styles.dialog,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        {icon && (
          <Shape shape={shape} size={48} tone={tone}>
            <Icon name={icon} />
          </Shape>
        )}
        <h2 id={titleId}>{title}</h2>
        {description && <p id={descriptionId}>{description}</p>}
        {children && <div className={styles.body}>{children}</div>}
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
