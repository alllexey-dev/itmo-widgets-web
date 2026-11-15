import { Button } from '@astryxdesign/core/Button';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { Heading } from '@astryxdesign/core/Heading';
import { IconButton } from '@astryxdesign/core/IconButton';
import { Popover } from '@astryxdesign/core/Popover';
import { Token, type TokenColor } from '@astryxdesign/core/Token';
import {
  ArrowLeft,
  Ban,
  Check,
  CircleHelp,
  Eye,
  EyeOff,
  FlagOff,
  SearchX,
  UserX,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { useApiMutation, useApiQuery, useForget } from '../../lib/data';
import { formatDateTime, formatRelative } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { useNotify } from '../../lib/notify';
import { hasAccess, useUser } from '../../lib/session';
import { casePath, decide, DECISION_FORGETS, MODERATION } from './api';
import { CaseAuthor } from './CaseAuthor';
import { CaseChanges } from './CaseChanges';
import { CaseHistory } from './CaseHistory';
import { LinkPreview, ReviewPreview } from './CasePreview';
import { HideAllDialog, RejectDialog, RestrictDialog } from './DecisionDialogs';
import { decisionsFor, isHidden, type DecisionOption } from './decisions';
import {
  CASE_STATUSES,
  doneText,
  OUTCOME_COLORS,
  periodLabel,
  REASONS,
  TARGET_TEXTS,
} from './labels';
import { useShortcuts } from './shortcuts';
import type { CaseTarget, DecisionRequest, ModerationAction, ModerationCase } from './types';

interface Props {
  caseId: string;
  /** Given on a phone, where the case takes the place of the queue. */
  onBack?: () => void;
  /** Called as soon as Backend accepted a decision, before the lists are fresh. */
  onDecided: (updated: ModerationCase) => void;
  /** Called when Backend refused a decision: the case may have changed under the moderator. */
  onRefused: () => void;
  /** Whether the buttons show their keys: where there is a keyboard to press them on. */
  hasKeys: boolean;
}

/** A decision as it is sent, with the toast of the option it came from. */
interface Decision {
  request: DecisionRequest;
  done?: string;
}

/** A review is named ISU first, as its queue row is, so the two can be matched; then the name. */
function titleOf(target: CaseTarget): string {
  if (target.targetType === 'SUBJECT_RESOURCE') return target.link.subjectName;
  return `ИСУ ${target.review.teacherIsu} · ${target.review.teacherName ?? 'имя не найдено'}`;
}

/** What the case is about, under its title: the term of a link's subject, or that it is a review. */
function kindOf(target: CaseTarget): string {
  if (target.targetType === 'SUBJECT_RESOURCE') {
    return `Ссылка · ${periodLabel(target.link.periodKey)}`;
  }
  const subject = target.revision.subjectTitle;
  return subject ? `Отзыв о преподавателе · ${subject}` : 'Отзыв о преподавателе';
}

/**
 * Whether a `DISMISS` on this case only closed it. That is what "Закрыть заявку" sends: the
 * revision is already rejected or withdrawn, and unless reports opened the case there were none to
 * dismiss. Backend records the same action for both, and the reports are gone either way.
 */
function isPlainClose(data: ModerationCase): boolean {
  const status = data.target?.revision.status;
  return data.reason !== 'REPORTS' && (status === 'REJECTED' || status === 'WITHDRAWN');
}

interface StateMark {
  label: string;
  color: TokenColor;
}

/**
 * What the target is now, next to the reason: hidden, and what became of the revision. An open
 * case says so only when the revision no longer waits (it was rejected while everything of the
 * author was hidden, say); a closed one always does, in the words of its queue row.
 */
function stateOf(data: ModerationCase): StateMark[] {
  const target = data.target;
  const closed = data.status !== 'OPEN';
  if (!target) return closed ? [CASE_STATUSES[data.status]] : [];
  const texts = TARGET_TEXTS[data.targetType];
  const marks: StateMark[] = [];
  const status = target.revision.status;
  if (status !== 'PENDING' && (closed || status !== 'APPROVED')) {
    marks.push({ label: texts.outcomes[status], color: OUTCOME_COLORS[status] });
  }
  if (isHidden(target)) marks.push({ label: texts.hidden, color: 'orange' });
  if (closed && marks.length === 0) marks.push(CASE_STATUSES[data.status]);
  return marks;
}

const DECISION_ICONS: Record<DecisionOption['action'], LucideIcon> = {
  APPROVE: Check,
  REJECT: X,
  HIDE: EyeOff,
  RESTORE: Eye,
  DISMISS: FlagOff,
};

/** The keys of the decisions act only from the queue and the case, never from a filter or the menu. */
const DECISION_AREA = '.mod-layout';

/**
 * One case. The page mounts a new instance per case, so a dialog or a decision in flight never leaks
 * into the next one, and the next case can be decided while the lists of the previous one reload.
 */
export function CaseDetail({ caseId, onBack, onDecided, onRefused, hasKeys }: Props) {
  const user = useUser();
  const notify = useNotify();
  const forget = useForget();
  const titleId = useId();
  const detail = useApiQuery<ModerationCase>(casePath(caseId));
  const [dialog, setDialog] = useState<'reject' | 'restrict' | 'hideAll' | null>(null);
  const [sent, setSent] = useState<ModerationAction | null>(null);

  const decision = useApiMutation({
    run: async ({ request, done }: Decision) => {
      const updated = await decide(caseId, request);
      // The moderator goes on at once; the queue and the counters catch up behind.
      setDialog(null);
      notify.show(done ?? doneText(request.action, updated.targetType));
      onDecided(updated);
      return updated;
    },
    forgets: DECISION_FORGETS,
    failed: 'Не удалось сохранить решение',
    errors: {
      business_rule_violation: 'Заявка уже закрыта или изменилась',
      invalid_request_data: 'Проверьте причину и срок',
    },
  });
  const pending = decision.isPending;

  function submit(request: DecisionRequest, done?: string) {
    if (pending) return;
    setSent(request.action);
    decision.mutateAsync({ request, done }).catch(() => {
      // A case closed by someone else: keep it open here in its current state, out of the queue.
      onRefused();
      return forget(MODERATION);
    });
  }

  const data = detail.data;
  const target = data?.target ?? null;
  const texts = data ? TARGET_TEXTS[data.targetType] : null;
  const open = data?.status === 'OPEN' && target !== null;
  const options = data ? decisionsFor(data) : [];
  const linkUrl = target?.targetType === 'SUBJECT_RESOURCE' ? target.revision.url : null;

  function take(option: DecisionOption) {
    if (option.action === 'REJECT') setDialog('reject');
    else submit({ action: option.action }, option.done);
  }

  const keys: Partial<Record<string, () => void>> = {};
  if (!pending && !dialog) {
    for (const option of options) {
      if (option.shortcut) keys[`Key${option.shortcut}`] = () => take(option);
    }
  }
  useShortcuts(keys, { within: DECISION_AREA });
  useShortcuts(
    linkUrl ? { KeyO: () => window.open(linkUrl, '_blank', 'noopener,noreferrer') } : {},
  );

  // The next case starts from its top, wherever the previous one was scrolled to. The mark has no
  // height, so nothing moves while it is on screen.
  const top = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    top.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const back = onBack ? (
    <IconButton label="К списку" icon={<ArrowLeft size={18} />} variant="ghost" onClick={onBack} />
  ) : null;
  const missing = detail.error instanceof ApiError && detail.error.code === 'not_found';

  function button(
    kind: ModerationAction,
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    props: {
      variant?: 'primary' | 'secondary' | 'ghost';
      size?: 'sm';
      shortcut?: string;
      hint: string;
    },
  ) {
    return (
      <Button
        key={kind}
        label={label}
        icon={icon}
        variant={props.variant ?? 'ghost'}
        size={props.size}
        tooltip={props.hint}
        // The key sits on the button it presses, so it always names what it will do here.
        endContent={
          hasKeys && props.shortcut ? (
            <kbd className="mod-key" aria-hidden>
              {props.shortcut}
            </kbd>
          ) : undefined
        }
        isDisabled={pending && sent !== kind}
        isLoading={pending && sent === kind}
        aria-keyshortcuts={props.shortcut}
        onClick={onClick}
      />
    );
  }

  const decisions =
    options.length > 0 ? (
      <div className="mod-actions" role="group" aria-label="Действия">
        {options.map((option, index) => {
          // Closing a case whose revision is already rejected goes as `DISMISS`, but is no dismissal.
          const closes = option.action === 'DISMISS' && option.done !== undefined;
          const Icon = closes ? Check : DECISION_ICONS[option.action];
          return button(option.action, option.label, <Icon size={16} />, () => take(option), {
            variant: open && index === 0 ? 'primary' : index < 2 ? 'secondary' : 'ghost',
            shortcut: option.shortcut,
            hint: option.hint,
          });
        })}
        <Popover
          label="Что делает каждое решение"
          width={340}
          placement="below"
          content={
            <dl className="mod-help">
              {options.map((option) => (
                <div key={option.action}>
                  <dt>{option.label}</dt>
                  <dd>{option.hint}</dd>
                </div>
              ))}
            </dl>
          }
        >
          <IconButton
            label="Что делает каждое решение"
            icon={<CircleHelp size={16} />}
            variant="ghost"
          />
        </Popover>
      </div>
    ) : null;

  return (
    <div className="mod-detail">
      <span ref={top} className="mod-top" />
      {missing ? (
        <>
          {back}
          <EmptyState
            icon={<SearchX size={32} />}
            title="Заявка не найдена"
            description="Возможно, её уже удалили."
            headingLevel={2}
          />
        </>
      ) : (
        <>
          {data ? null : back}
          <Loadable
            resource={detail}
            label="Загружаем заявку"
            errorTitle="Не удалось загрузить заявку"
          >
            {(data) => {
              const reason = REASONS[data.reason];
              const closedAt =
                data.status === 'OPEN' ? undefined : data.decisions.at(-1)?.createdAt;
              return (
                <article className="mod-case" aria-labelledby={titleId}>
                  <header className="mod-head">
                    {back}
                    <div className="mod-head-text">
                      <div className="mod-tokens">
                        <Token label={reason.mark} color={reason.color} size="sm" />
                        {stateOf(data).map((mark) => (
                          <Token key={mark.label} label={mark.label} color={mark.color} size="sm" />
                        ))}
                        <span className="mod-muted">
                          <span title={formatDateTime(data.openedAt)}>
                            открыта {formatRelative(data.openedAt)}
                          </span>
                          {closedAt ? (
                            <span title={formatDateTime(closedAt)}>
                              {' · закрыта '}
                              {formatRelative(closedAt)}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <Heading level={2} id={titleId}>
                        {target ? titleOf(target) : texts?.deleted}
                      </Heading>
                      {target ? <span className="mod-muted">{kindOf(target)}</span> : null}
                    </div>
                  </header>

                  {data.status === 'WITHDRAWN' && target && texts ? (
                    <p className="mod-note">
                      {
                        texts.withdrawn[
                          target.revision.status === 'PENDING'
                            ? 'WITHDRAWN'
                            : target.revision.status
                        ]
                      }
                    </p>
                  ) : null}

                  {target && texts ? (
                    <>
                      {decisions}

                      {target.targetType === 'SUBJECT_RESOURCE' ? (
                        <LinkPreview target={target} hasKeys={hasKeys} />
                      ) : (
                        <ReviewPreview target={target} />
                      )}
                      <CaseChanges target={target} />
                      <CaseAuthor
                        author={target.author}
                        history={target.submitterHistory}
                        labels={texts.history}
                        canOpenProfile={hasAccess(user, 'admin')}
                        actions={
                          open ? (
                            <>
                              {button(
                                'RESTRICT_USER',
                                'Ограничить',
                                <Ban size={16} />,
                                () => setDialog('restrict'),
                                {
                                  size: 'sm',
                                  hint: 'Запрещает автору одно действие или все на выбранный срок. Причину автор увидит в приложении. Заявка останется открытой.',
                                },
                              )}
                              {button(
                                'HIDE_ALL_BY_USER',
                                texts.hideAll,
                                <UserX size={16} />,
                                () => setDialog('hideAll'),
                                {
                                  size: 'sm',
                                  hint: 'Скрывает всё опубликованное автором и отклоняет то, что ждёт проверки. Заявка останется открытой.',
                                },
                              )}
                            </>
                          ) : null
                        }
                      />
                    </>
                  ) : texts ? (
                    <p className="mod-note">{texts.deletedNote}</p>
                  ) : null}
                  <CaseHistory
                    reports={target?.reports ?? null}
                    decisions={data.decisions}
                    isClosed={data.status !== 'OPEN'}
                    isPlainClose={isPlainClose(data)}
                  />
                </article>
              );
            }}
          </Loadable>
        </>
      )}

      {target && texts && dialog === 'reject' ? (
        <RejectDialog
          title={texts.rejectTitle}
          presets={texts.rejectPresets}
          isSaving={pending}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {target && texts && dialog === 'restrict' ? (
        <RestrictDialog
          authorName={target.author.name}
          defaultCapability={texts.restriction}
          active={target.submitterHistory.activeRestrictions}
          isSaving={pending}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {target && texts && dialog === 'hideAll' ? (
        <HideAllDialog
          title={`${texts.hideAll}?`}
          text={texts.hideAllText(target.author.name)}
          authorName={target.author.name}
          isSaving={pending}
          onSubmit={submit}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
