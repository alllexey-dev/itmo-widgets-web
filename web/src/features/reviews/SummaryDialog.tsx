import { useState } from 'react';
import { errorText } from '../../api/errors';
import {
  Badge,
  Button,
  Chip,
  Dialog,
  formatDateTime,
  formatNumber,
  plural,
  useSnackbars,
} from '../../ui';
import { useAiSummaries, useRegenerateSummary, useSetSummaryHidden } from './api';
import {
  SUMMARY_CONFIDENCES,
  SUMMARY_LEVELS,
  SUMMARY_SCALE_VALUES,
  SUMMARY_SCALES,
  SUMMARY_STATUSES,
  summaryTagLabel,
} from './labels';
import styles from './ReviewsPage.module.css';
import type { TeacherSummary, TeacherSummaryRow } from './types';

/** The backend builds a summary from at least this many reviews. */
const MIN_REVIEWS = 3;

const ERRORS = {
  not_found: 'Сводка не найдена',
  business_rule_violation: 'Сейчас пересчитать нельзя',
};

export interface SummaryDialogProps {
  row: TeacherSummaryRow;
  onClose: () => void;
}

/** Texts come from the model and are shown as plain text only. */
export function SummaryDialog({ row: initial, onClose }: SummaryDialogProps) {
  const snackbars = useSnackbars();
  const state = useAiSummaries();
  const setHidden = useSetSummaryHidden();
  const regenerate = useRegenerateSummary();
  const [row, setRow] = useState(initial);
  const busy = setHidden.isPending || regenerate.isPending;
  const canRegenerate =
    state.data?.enabled === true && !row.hidden && row.inputCount >= MIN_REVIEWS;

  const toggleHidden = () =>
    setHidden.mutate(
      { isu: row.teacherIsu, hidden: !row.hidden },
      {
        onSuccess: setRow,
        onError: (error) =>
          snackbars.error(
            errorText(
              error,
              row.hidden ? 'Не удалось показать сводку' : 'Не удалось скрыть сводку',
              ERRORS,
            ),
          ),
      },
    );

  const requestRegeneration = () =>
    regenerate.mutate(row.teacherIsu, {
      onSuccess: (updated) => {
        setRow(updated);
        snackbars.show('Пересчёт запрошен');
      },
      onError: (error) =>
        snackbars.error(errorText(error, 'Не удалось пересчитать сводку', ERRORS)),
    });

  const status = SUMMARY_STATUSES[row.status];
  return (
    <Dialog
      open
      onClose={onClose}
      title={row.teacherName ?? `ИСУ ${row.teacherIsu}`}
      description={row.teacherName ? `ИСУ ${row.teacherIsu}` : undefined}
      size="large"
      actions={
        <>
          <Button variant="text" onClick={onClose}>
            Закрыть
          </Button>
          <Button
            variant="tonal"
            icon={row.hidden ? 'visibility' : 'visibility_off'}
            loading={setHidden.isPending}
            disabled={busy}
            onClick={toggleHidden}
          >
            {row.hidden ? 'Показать' : 'Скрыть'}
          </Button>
          <Button
            icon="refresh"
            loading={regenerate.isPending}
            disabled={busy || !canRegenerate}
            onClick={requestRegeneration}
          >
            Пересчитать
          </Button>
        </>
      }
    >
      <div className={styles.summary}>
        <p className={styles.state}>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span>Отзывов сейчас: {formatNumber(row.inputCount)}</span>
          {row.hiddenAt && (
            <span>
              {row.hiddenByName ? `Кто скрыл: ${row.hiddenByName} · ` : 'Скрыта '}
              {formatDateTime(row.hiddenAt)}
            </span>
          )}
        </p>
        {row.lastError && (
          <p className={styles.state}>
            <code className={styles.error}>{row.lastError}</code>
            <span>
              Попыток: {formatNumber(row.attempts)}
              {row.lastAttemptAt && ` · ${formatDateTime(row.lastAttemptAt)}`}
            </span>
          </p>
        )}
        {row.summary ? (
          <SummaryContent summary={row.summary} />
        ) : (
          <p className="m3-muted">Сводки ещё нет</p>
        )}
      </div>
    </Dialog>
  );
}

function SummaryContent({ summary }: { summary: TeacherSummary }) {
  const count = summary.reviewCount;
  return (
    <>
      <p className="m3-muted">
        Сводка по {formatNumber(count)} {plural(count, ['отзыву', 'отзывам', 'отзывам'])} · ИИ ·{' '}
        {formatDateTime(summary.generatedAt)}
      </p>
      <p>
        Тон: {SUMMARY_LEVELS[summary.level]}
        <span className="m3-muted"> · уверенность {SUMMARY_CONFIDENCES[summary.confidence]}</span>
      </p>
      <p className={styles.text}>{summary.description}</p>
      <Points title="Плюсы" items={summary.pros} />
      <Points title="Минусы" items={summary.cons} />
      {summary.tags.length > 0 && (
        <ul className={styles.tags} aria-label="Теги">
          {summary.tags.map((tag) => (
            <li key={tag}>
              <Chip>{summaryTagLabel(tag)}</Chip>
            </li>
          ))}
        </ul>
      )}
      <dl className={styles.scales} aria-label="Шкалы">
        {summary.scales.map((scale) => (
          <div key={scale.kind}>
            <dt>{SUMMARY_SCALES[scale.kind]}</dt>
            <dd>
              {SUMMARY_SCALE_VALUES[scale.kind][scale.value]}
              {scale.reason && <span className="m3-muted"> · {scale.reason}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function Points({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.points} aria-label={title}>
      <h3 className={styles.pointsTitle}>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item} className={styles.text}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
