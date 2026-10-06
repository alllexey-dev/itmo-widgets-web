import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { SnackbarContext, type SnackOptions } from './snackbar';

interface Snack {
  id: number;
  text: string;
  error: boolean;
  action?: SnackOptions['action'];
}

const MAX_VISIBLE = 3;
const DURATION = 4000;
const LONG_DURATION = 8000;

/** The app-wide snackbar queue of `@alllexey/ui`: at most three, bottom centre, errors longer. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setSnacks((current) => current.filter((snack) => snack.id !== id));
  }, []);

  const show = useCallback(
    (text: string, { error = false, action, duration }: SnackOptions = {}) => {
      const id = nextId.current++;
      setSnacks((current) => [...current, { id, text, error, action }].slice(-MAX_VISIBLE));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration ?? (error || action ? LONG_DURATION : DURATION)),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const api = useMemo(
    () => ({ show, error: (text: string) => show(text, { error: true }) }),
    [show],
  );

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="m3-snackbars" role="status" aria-live="polite">
          {snacks.map((snack) => (
            <div
              key={snack.id}
              className={cx('m3-snackbar', snack.error && 'error')}
              role={snack.error ? 'alert' : undefined}
            >
              <span>{snack.text}</span>
              {snack.action && (
                <button
                  type="button"
                  onClick={() => {
                    snack.action?.run();
                    dismiss(snack.id);
                  }}
                >
                  {snack.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </SnackbarContext.Provider>
  );
}
