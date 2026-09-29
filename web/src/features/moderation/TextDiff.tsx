import styles from './CaseDetail.module.css';
import { wordDiff } from './wordDiff';

/** One text with deleted words struck through and added ones highlighted. */
export function TextDiff({ before, after }: { before: string; after: string }) {
  return (
    <p className={styles.textDiff}>
      {wordDiff(before, after).map((part, index) => {
        if (part.kind === 'removed') {
          return (
            <del key={index} className={styles.removed}>
              <span className="visually-hidden">удалено: </span>
              {part.text}
            </del>
          );
        }
        if (part.kind === 'added') {
          return (
            <ins key={index} className={styles.added}>
              <span className="visually-hidden">добавлено: </span>
              {part.text}
            </ins>
          );
        }
        return <span key={index}>{part.text}</span>;
      })}
    </p>
  );
}
