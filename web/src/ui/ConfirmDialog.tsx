import { useId, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';
import { Dialog } from './Dialog';
import type { IconName } from './icons';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  /** A verb, e.g. «Снять», never «ОК». */
  confirmLabel: string;
  cancelLabel?: string;
  /** Error colours for actions with noticeable consequences. */
  danger?: boolean;
  /**
   * For destructive, irreversible actions: the button stays disabled until this exact text
   * (usually the object's name) is typed.
   */
  requireText?: string;
  icon?: IconName;
  /** Keeps the dialog open and blocks the buttons while the action runs. */
  loading?: boolean;
  /** Extra content, e.g. a form field; the confirm button stays the main action. */
  children?: ReactNode;
  confirmDisabled?: boolean;
}

/** A question with a verb on the button. Enter confirms, Esc cancels. */
export function ConfirmDialog({ open, ...props }: ConfirmDialogProps) {
  // Mounted only while open, so the typed confirmation never survives a close.
  return open ? <OpenConfirmDialog {...props} /> : null;
}

function OpenConfirmDialog({
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Отмена',
  danger = false,
  requireText = '',
  icon = danger ? 'warning' : 'help',
  loading = false,
  children,
  confirmDisabled = false,
}: Omit<ConfirmDialogProps, 'open'>) {
  const [typed, setTyped] = useState('');
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const ready = !requireText || typed.trim() === requireText;
  const disabled = confirmDisabled || !ready;

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      shape={danger ? 'softBurst' : 'cookie9'}
      tone={danger ? 'error' : 'secondary'}
      dismissible={!loading}
      initialFocusRef={requireText ? inputRef : confirmRef}
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            danger={danger}
            loading={loading}
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
      {requireText && (
        <div className={styles.type}>
          <label htmlFor={inputId} className="m3-body-small m3-muted">
            Чтобы подтвердить, введите <b>{requireText}</b>
          </label>
          <input
            ref={inputRef}
            id={inputId}
            className="m3-field"
            autoComplete="off"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !disabled && !loading) onConfirm();
            }}
          />
        </div>
      )}
    </Dialog>
  );
}
