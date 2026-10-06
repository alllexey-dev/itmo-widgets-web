import styles from './Countdown.module.css';

function formatSeconds(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export interface CountdownProps {
  /** Milliseconds left. */
  remaining: number;
  /** Full lifetime in milliseconds, for the progress. */
  total: number;
}

export function Countdown({ remaining, total }: CountdownProps) {
  const percent = total > 0 ? Math.round((remaining / total) * 100) : 0;
  return (
    <div className={styles.countdown}>
      <p>
        Код действует ещё <span className={styles.time}>{formatSeconds(remaining)}</span>
      </p>
      <m3-progress value={percent} className={styles.progress} aria-hidden="true" />
    </div>
  );
}
