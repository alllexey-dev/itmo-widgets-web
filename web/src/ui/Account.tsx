import styles from './Account.module.css';
import { Avatar } from './Avatar';
import { cx } from './cx';

export interface AccountProps {
  name: string;
  pictureUrl?: string | null;
  /** One line under the name, e.g. «ИСУ 400001». */
  status?: string;
}

/** The signed-in user at the bottom of the AppShell rail; the text hides on a collapsed rail. */
export function Account({ name, pictureUrl, status }: AccountProps) {
  return (
    <div className={cx('m3-account', styles.account)}>
      <Avatar name={name} src={pictureUrl} size={36} decorative />
      <div className={cx('rail-text', styles.text)}>
        <div className={cx('m3-clip', styles.name)}>{name || '—'}</div>
        {status && <div className={styles.status}>{status}</div>}
      </div>
    </div>
  );
}
