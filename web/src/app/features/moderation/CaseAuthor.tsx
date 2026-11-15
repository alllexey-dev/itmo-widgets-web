import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { Ban } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate } from '../../lib/format';
import { Fact } from './CasePreview';
import { CAPABILITIES } from './labels';
import { Section } from './Section';
import type { AdminUserSummary, SubmitterHistory } from './types';

interface Props {
  author: AdminUserSummary;
  history: SubmitterHistory;
  /** The figures count links or reviews, whichever the case is about; the labels say which. */
  labels: { approved: string; rejected: string };
  /** The user card is an administrator's page. */
  canOpenProfile: boolean;
  /** What a moderator can do about the author, next to the history that informs it. */
  actions?: ReactNode;
}

function groupOf(author: AdminUserSummary): string | null {
  const [first] = author.groups;
  if (!first) return null;
  return [first.name, first.course > 0 ? `${first.course} курс` : null, first.facultyShortName]
    .filter(Boolean)
    .join(' · ');
}

/** Who sent it and how their earlier submissions went; moderators see the author even of an anonymous review. */
export function CaseAuthor({ author, history, labels, canOpenProfile, actions }: Props) {
  const group = groupOf(author);
  return (
    <Section title="Автор">
      <div className="mod-author">
        <Avatar name={author.name} src={author.pictureUrl ?? undefined} size={40} />
        <div className="mod-author-text">
          <span className="mod-author-name">{author.name}</span>
          <span className="mod-muted">
            ИСУ {author.isu}
            {group ? ` · ${group}` : ''}
          </span>
        </div>
        <div className="mod-author-actions">
          {canOpenProfile ? (
            <Button label="Профиль" href={`/admin/users/${author.isu}`} variant="ghost" size="sm" />
          ) : null}
          {actions}
        </div>
      </div>
      <dl className="mod-facts">
        <Fact label={labels.approved}>{history.approved}</Fact>
        <Fact label={labels.rejected}>{history.rejected}</Fact>
        {/* Backend counts the reports the author made, not the ones made against them. */}
        <Fact label="Жалоб автора отклонено">{history.dismissedReports}</Fact>
      </dl>
      {history.activeRestrictions.length > 0 ? (
        <ul className="mod-restrictions" aria-label="Действующие ограничения">
          {history.activeRestrictions.map((restriction) => (
            <li key={restriction.id}>
              <Ban size={16} aria-hidden />
              <span>
                <strong>{CAPABILITIES[restriction.capability]}</strong> ·{' '}
                {restriction.expiresAt ? `до ${formatDate(restriction.expiresAt)}` : 'бессрочно'}
                {restriction.reason ? (
                  <span className="mod-muted"> — {restriction.reason}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  );
}
