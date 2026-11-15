import { CircleCheck } from 'lucide-react';
import { formatDateTime, formatRelative } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { ACTIONS, CAPABILITIES, REPORT_REASONS } from './labels';
import { Section } from './Section';
import type { ModerationDecision, ModerationReport } from './types';

interface Props {
  /** Reports against the target; null when the target is gone. */
  reports: ModerationReport[] | null;
  decisions: ModerationDecision[];
  /** A closed case gets no more decisions, so an empty log is final. */
  isClosed: boolean;
  /**
   * Whether dismissing meant only closing the case: its revision was already rejected and no
   * reports had brought it here, so there was nothing to dismiss.
   */
  isPlainClose: boolean;
}

/** How the log names a decision; `DISMISS` is named by what it meant for this case. */
function nameOf(decision: ModerationDecision, isPlainClose: boolean) {
  if (decision.action === 'DISMISS' && isPlainClose) {
    return { label: 'Заявка закрыта', icon: CircleCheck };
  }
  return ACTIONS[decision.action];
}

function restrictionText(decision: ModerationDecision): string | null {
  const restriction = decision.restriction;
  if (!restriction) return null;
  const term = restriction.days ? `на ${restriction.days} дн.` : 'бессрочно';
  return `${CAPABILITIES[restriction.capability]}, ${term}`;
}

/** Reports against the target and every decision of the case, oldest first. */
export function CaseHistory({ reports, decisions, isClosed, isPlainClose }: Props) {
  return (
    <>
      {reports ? (
        <Section title="Жалобы" count={reports.length}>
          {reports.length === 0 ? (
            <p className="mod-muted mod-empty">Жалоб нет</p>
          ) : (
            <ul className="mod-reports">
              {reports.map((report, index) => (
                <li key={`${report.createdAt}-${index}`}>
                  <span className="mod-strong">{REPORT_REASONS[report.reason]}</span>
                  <span className="mod-muted">
                    {report.comment ? `«${report.comment}» · ` : ''}
                    <span title={formatDateTime(report.createdAt)}>
                      {formatRelative(report.createdAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ) : null}

      <Section title="Решения">
        {decisions.length === 0 ? (
          <p className="mod-muted mod-empty">{isClosed ? 'Решений нет' : 'Решений пока нет'}</p>
        ) : (
          <ol className="mod-timeline">
            {decisions.map((decision) => {
              const action = nameOf(decision, isPlainClose);
              const restriction = restrictionText(decision);
              return (
                <li key={decision.id}>
                  <IconTile icon={action.icon} size="sm" />
                  <div className="mod-event">
                    <span className="mod-strong">{action.label}</span>
                    <span className="mod-muted">
                      {decision.actor === 'POLICY' ? 'Автоматически' : 'Модератор'} ·{' '}
                      {formatDateTime(decision.createdAt)}
                    </span>
                    {restriction ? <span>{restriction}</span> : null}
                    {decision.note ? <p className="mod-decision-note">{decision.note}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </>
  );
}
