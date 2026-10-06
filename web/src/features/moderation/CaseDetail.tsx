import { useState } from 'react';
import type { RestrictionCapability } from '../../api/admin';
import { ApiError } from '../../api/client';
import { errorText } from '../../api/errors';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  formatDateTime,
  IconButton,
  Kbd,
  LoadingIndicator,
  useSnackbars,
} from '../../ui';
import { useAccess } from '../auth/useSession';
import { useCase, useDecision } from './api';
import {
  AuthorSection,
  ChangesSection,
  DecisionsTimeline,
  LinkPreview,
  ReportsSection,
  ReviewChangesSection,
  ReviewPreview,
} from './CaseSections';
import { HideAllDialog, RejectDialog, RestrictDialog } from './DecisionDialogs';
import {
  CASE_STATUSES,
  doneText,
  LINK_REJECT_PRESETS,
  periodLabel,
  REASONS,
  REVIEW_REJECT_PRESETS,
} from './labels';
import styles from './CaseDetail.module.css';
import type { CaseTarget, DecisionRequest, ModerationCase, TargetType } from './types';
import { useShortcuts } from './useShortcuts';

type OpenDialog = 'reject' | 'restrict' | 'hideAll' | null;

interface TargetTexts {
  deleted: string;
  deletedNote: string;
  rejectTitle: string;
  rejectPresets: readonly string[];
  restriction: RestrictionCapability;
}

const TARGET_TEXTS: Record<TargetType, TargetTexts> = {
  SUBJECT_RESOURCE: {
    deleted: 'Ссылка удалена',
    deletedNote: 'Автор удалил ссылку; остались только решения.',
    rejectTitle: 'Отклонить ссылку',
    rejectPresets: LINK_REJECT_PRESETS,
    restriction: 'SUBMIT_RESOURCES',
  },
  TEACHER_REVIEW: {
    deleted: 'Отзыв удалён',
    deletedNote: 'Автор удалил отзыв; остались только решения.',
    rejectTitle: 'Отклонить отзыв',
    rejectPresets: REVIEW_REJECT_PRESETS,
    restriction: 'WRITE_REVIEWS',
  },
};

function targetTitle(target: CaseTarget): string {
  if (target.targetType === 'SUBJECT_RESOURCE') return target.link.subjectName;
  const { teacherName, teacherIsu } = target.review;
  return `${teacherName ?? 'Преподаватель'} · ИСУ ${teacherIsu}`;
}

function isHidden(target: CaseTarget): boolean {
  return target.targetType === 'SUBJECT_RESOURCE'
    ? target.link.status === 'HIDDEN'
    : target.review.hidden;
}

export interface CaseDetailProps {
  caseId: string;
  /** Shown on narrow screens, where the detail replaces the list. */
  onBack?: () => void;
  onDecided: (updated: ModerationCase) => void;
}

export function CaseDetail({ caseId, onBack, onDecided }: CaseDetailProps) {
  const query = useCase(caseId);

  if (query.isPending) return <DetailLoading />;
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.code === 'not_found';
    return (
      <div className={styles.detail}>
        {onBack && <BackButton onBack={onBack} />}
        {missing ? (
          <EmptyState
            icon="search_off"
            title="Заявка не найдена"
            description="Возможно, её уже удалили."
          />
        ) : (
          <ErrorState
            title="Не удалось загрузить заявку"
            description={errorText(query.error, 'Попробуйте ещё раз.')}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        )}
      </div>
    );
  }
  // A new key per case resets dialogs and the pending decision when the selection moves.
  return <CaseView key={query.data.id} data={query.data} onBack={onBack} onDecided={onDecided} />;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return <IconButton icon="arrow_back" label="К списку" className={styles.back} onClick={onBack} />;
}

function CaseView({
  data,
  onBack,
  onDecided,
}: {
  data: ModerationCase;
  onBack?: () => void;
  onDecided: (updated: ModerationCase) => void;
}) {
  const canOpenProfile = useAccess('admin');
  const snackbars = useSnackbars();
  const decision = useDecision(data.id);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const target = data.target;
  const texts = TARGET_TEXTS[data.targetType];
  const open = data.status === 'OPEN' && target !== null;

  const decide = (request: DecisionRequest) => {
    decision.mutate(request, {
      onSuccess: (updated) => {
        setDialog(null);
        snackbars.show(doneText(request.action, data.targetType));
        onDecided(updated);
      },
      onError: (error) =>
        snackbars.error(
          errorText(error, 'Не удалось сохранить решение', {
            business_rule_violation: 'Заявка уже закрыта',
            invalid_request_data: 'Проверьте причину и срок',
          }),
        ),
    });
  };

  useShortcuts(
    {
      KeyA: () => decide({ action: 'APPROVE' }),
      KeyR: () => setDialog('reject'),
    },
    open && !decision.isPending && dialog === null,
  );

  const reason = REASONS[data.reason];
  const status = CASE_STATUSES[data.status];
  return (
    <article className={styles.detail} aria-labelledby="case-title">
      <header className={styles.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={styles.headerText}>
          <div className={styles.badges}>
            <Badge tone={reason.tone} icon={reason.icon}>
              {reason.label}
            </Badge>
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className={styles.muted}>с {formatDateTime(data.openedAt)}</span>
          </div>
          <h2 id="case-title" className={styles.title}>
            {target ? targetTitle(target) : texts.deleted}
          </h2>
          {target?.targetType === 'SUBJECT_RESOURCE' && (
            <p className={styles.muted}>{periodLabel(target.link.periodKey)}</p>
          )}
        </div>
      </header>

      {target ? (
        <>
          <CaseActions
            open={open}
            target={target}
            saving={decision.isPending}
            pendingAction={decision.isPending ? decision.variables.action : null}
            onDecide={decide}
            onOpenDialog={setDialog}
          />
          {target.targetType === 'SUBJECT_RESOURCE' ? (
            <>
              <LinkPreview target={target} />
              <ChangesSection target={target} />
            </>
          ) : (
            <>
              <ReviewPreview target={target} />
              <ReviewChangesSection target={target} />
            </>
          )}
          <AuthorSection
            author={target.author}
            submitterHistory={target.submitterHistory}
            canOpenProfile={canOpenProfile}
          />
          <ReportsSection reports={target.reports} />
        </>
      ) : (
        <p className={styles.note}>{texts.deletedNote}</p>
      )}
      <DecisionsTimeline decisions={data.decisions} />

      {target && dialog === 'reject' && (
        <RejectDialog
          open
          onClose={() => setDialog(null)}
          onSubmit={decide}
          saving={decision.isPending}
          title={texts.rejectTitle}
          presets={texts.rejectPresets}
        />
      )}
      {target && dialog === 'restrict' && (
        <RestrictDialog
          open
          onClose={() => setDialog(null)}
          onSubmit={decide}
          saving={decision.isPending}
          authorName={target.author.name}
          defaultCapability={texts.restriction}
        />
      )}
      {target && dialog === 'hideAll' && (
        <HideAllDialog
          open
          onClose={() => setDialog(null)}
          onSubmit={decide}
          saving={decision.isPending}
          authorName={target.author.name}
          targetType={data.targetType}
        />
      )}
    </article>
  );
}

function CaseActions({
  open,
  target,
  saving,
  pendingAction,
  onDecide,
  onOpenDialog,
}: {
  open: boolean;
  target: CaseTarget;
  saving: boolean;
  pendingAction: DecisionRequest['action'] | null;
  onDecide: (request: DecisionRequest) => void;
  onOpenDialog: (dialog: OpenDialog) => void;
}) {
  const hidden = isHidden(target);
  const restore = (
    <Button
      variant={open ? 'text' : 'tonal'}
      icon="visibility"
      loading={pendingAction === 'RESTORE'}
      disabled={saving}
      onClick={() => onDecide({ action: 'RESTORE' })}
    >
      Вернуть
    </Button>
  );
  if (!open) {
    return hidden ? (
      <div className={styles.actions} role="group" aria-label="Действия">
        {restore}
      </div>
    ) : null;
  }
  return (
    <div className={styles.actions} role="group" aria-label="Действия">
      <div className={styles.mainActions}>
        <Button
          icon="check"
          loading={pendingAction === 'APPROVE'}
          disabled={saving}
          onClick={() => onDecide({ action: 'APPROVE' })}
          aria-keyshortcuts="A"
        >
          Одобрить
        </Button>
        <Button
          variant="tonal"
          danger
          icon="close"
          disabled={saving}
          onClick={() => onOpenDialog('reject')}
          aria-keyshortcuts="R"
        >
          Отклонить
        </Button>
      </div>
      <div className={styles.moreActions}>
        {hidden ? (
          restore
        ) : (
          <Button
            variant="text"
            icon="visibility_off"
            loading={pendingAction === 'HIDE'}
            disabled={saving}
            onClick={() => onDecide({ action: 'HIDE' })}
          >
            Скрыть
          </Button>
        )}
        {target.reports.length > 0 && (
          <Button
            variant="text"
            icon="flag"
            loading={pendingAction === 'DISMISS'}
            disabled={saving}
            onClick={() => onDecide({ action: 'DISMISS' })}
          >
            Отклонить жалобы
          </Button>
        )}
        <Button
          variant="text"
          icon="block"
          disabled={saving}
          onClick={() => onOpenDialog('restrict')}
        >
          Ограничить
        </Button>
        <Button
          variant="text"
          danger
          icon="hide_source"
          disabled={saving}
          onClick={() => onOpenDialog('hideAll')}
        >
          Скрыть всё у автора
        </Button>
      </div>
    </div>
  );
}

export function ShortcutHint() {
  return (
    <p className={styles.hint}>
      <span>
        <Kbd>J</Kbd> <Kbd>K</Kbd> следующая и предыдущая
      </span>
      <span>
        <Kbd>A</Kbd> одобрить
      </span>
      <span>
        <Kbd>R</Kbd> отклонить
      </span>
    </p>
  );
}

function DetailLoading() {
  return <LoadingIndicator label="Загружаем заявку" />;
}
