import { Button } from '@astryxdesign/core/Button';
import { Token } from '@astryxdesign/core/Token';
import { CircleCheck, Undo2 } from 'lucide-react';
import { formatDateTime, formatRelative, TIME_ZONE } from '../../lib/format';
import { IconTile } from '../../lib/IconTile';
import { ACTIONS, CAPABILITIES, REPORT_REASONS, revertHint } from './labels';
import { canRevert, useNowPast } from './revert';
import { Section } from './Section';
import type { ModerationDecision, ModerationReport, TargetType } from './types';

const clockFormat = new Intl.DateTimeFormat('ru-RU', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

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
  targetType: TargetType;
  /** The decision being taken back, while it is. */
  revertingId: string | null;
  onUndo: (decision: ModerationDecision) => void;
  /** The name of a flow of the link, for an approval that moved it to another flow. */
  flowName?: (flowId: number) => string | null;
}

/**
 * How the log names a decision; `DISMISS` is named by what it meant for this case, an `APPROVE`
 * that moved a link to another flow by that flow.
 */
function nameOf(decision: ModerationDecision, isPlainClose: boolean, flowName: Props['flowName']) {
  if (decision.action === 'DISMISS' && isPlainClose) {
    return { label: 'Заявка закрыта', icon: CircleCheck };
  }
  const flowId = decision.flowId;
  if (decision.action === 'APPROVE' && flowId != null) {
    const flow = flowName?.(flowId) ?? `№ ${flowId}`;
    return { ...ACTIONS.APPROVE, label: `${ACTIONS.APPROVE.label} для потока ${flow}` };
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
export function CaseHistory({
  reports,
  decisions,
  isClosed,
  isPlainClose,
  targetType,
  revertingId,
  onUndo,
  flowName,
}: Props) {
  // Backend marks at most one decision as revertible; its offer goes away when the window ends.
  const now = useNowPast(decisions.map((decision) => decision.revertibleUntil));
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
              const action = nameOf(decision, isPlainClose, flowName);
              const restriction = restrictionText(decision);
              const until = canRevert(decision, now) ? decision.revertibleUntil : null;
              return (
                <li key={decision.id} data-reverted={decision.revertedAt ? true : undefined}>
                  <IconTile icon={action.icon} size="sm" />
                  <div className="mod-event">
                    <span className="mod-event-head">
                      <span className="mod-strong mod-event-label">{action.label}</span>
                      {decision.revertedAt ? (
                        <Token label="Отменено" color="gray" size="sm" />
                      ) : null}
                    </span>
                    <span className="mod-muted">
                      {decision.actor === 'POLICY' ? 'Автоматически' : 'Модератор'} ·{' '}
                      {formatDateTime(decision.createdAt)}
                    </span>
                    {decision.revertedAt ? (
                      <span className="mod-muted">
                        Отменено {formatDateTime(decision.revertedAt)}
                      </span>
                    ) : null}
                    {restriction ? <span>{restriction}</span> : null}
                    {decision.note ? <p className="mod-decision-note">{decision.note}</p> : null}
                    {until ? (
                      <span className="mod-undo">
                        <Button
                          label="Отменить"
                          aria-label={`Отменить решение «${action.label}»`}
                          icon={<Undo2 size={16} />}
                          variant="secondary"
                          size="sm"
                          tooltip={revertHint(decision.action, targetType)}
                          isLoading={revertingId === decision.id}
                          onClick={() => onUndo(decision)}
                        />
                        <span className="mod-muted">
                          можно до {clockFormat.format(new Date(until))}
                        </span>
                      </span>
                    ) : null}
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
