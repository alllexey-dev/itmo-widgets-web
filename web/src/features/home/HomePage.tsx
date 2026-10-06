import { useId } from 'react';
import { Link } from 'react-router';
import type { GroupData } from '../../api/admin';
import { useOpenCaseCount } from '../../api/moderation';
import { Avatar, Badge, Card, cx, Icon, LoadingIndicator, PageHeader, Shape } from '../../ui';
import { displayName, hasAccess, type Session } from '../auth/session';
import { useSession } from '../auth/useSession';
import styles from './HomePage.module.css';

export function HomePage() {
  const session = useSession();
  const moderator = hasAccess(session, 'moderator');
  return (
    <>
      <PageHeader
        title="Главная"
        description={moderator ? 'Ваш профиль и очередь модерации' : 'Ваш профиль в ITMO.Widgets'}
      />
      <div className={styles.grid}>
        <ProfileCard session={session} />
        {moderator ? <OpenCasesCard /> : <ComingSoonCard />}
      </div>
    </>
  );
}

function groupLine({ name, course, facultyShortName }: GroupData): string {
  return [name, course > 0 ? `${course} курс` : null, facultyShortName].filter(Boolean).join(' · ');
}

function roleLabel(session: Session): string | null {
  if (hasAccess(session, 'admin')) return 'Администратор';
  if (hasAccess(session, 'moderator')) return 'Модератор';
  return null;
}

function ProfileCard({ session }: { session: Session }) {
  const titleId = useId();
  const name = displayName(session);
  const role = roleLabel(session);
  return (
    <Card as="section" className={styles.profile} aria-labelledby={titleId}>
      <Avatar name={name} src={session.pictureUrl} size={80} decorative />
      <div className={styles.profileText}>
        <h2 id={titleId} className={styles.name}>
          {name}
        </h2>
        <p className="m3-muted">ИСУ {session.isu}</p>
        {session.groups.map((group) => (
          <p key={group.name} className="m3-muted">
            {groupLine(group)}
          </p>
        ))}
        {role && (
          <Badge tone="info" icon="shield_person" className={styles.role}>
            {role}
          </Badge>
        )}
      </div>
    </Card>
  );
}

/** Hidden quietly when the queue does not load: the rail still leads there. */
function OpenCasesCard() {
  const count = useOpenCaseCount();
  if (count.isPending) {
    return (
      <Card className={styles.casesWaiting}>
        <LoadingIndicator compact label="Загружаем открытые заявки" />
      </Card>
    );
  }
  if (count.isError) return null;
  return (
    <Link to="/admin/moderation" className={cx('m3-card primary', styles.cases)}>
      <span className={styles.casesLabel}>
        <Icon name="gavel" size={20} />
        Открытые заявки
      </span>
      <span className={cx(styles.casesValue, 'm3-num')}>{count.data}</span>
      <span className={styles.casesAction}>
        Открыть очередь
        <Icon name="arrow_forward" size={18} />
      </span>
    </Link>
  );
}

function ComingSoonCard() {
  return (
    <Card as="section" className={styles.soon} aria-label="Веб-версия">
      <Shape shape="sunny" size={56} tone="tertiary">
        <Icon name="construction" />
      </Shape>
      <div className={styles.soonText}>
        <p className="m3-title-medium">Веб-версия в разработке</p>
        <p className="m3-muted">
          Скоро здесь появятся расписание, оценки и другие разделы приложения.
        </p>
      </div>
    </Card>
  );
}
