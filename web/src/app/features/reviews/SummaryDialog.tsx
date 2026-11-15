import { Button } from '@astryxdesign/core/Button';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout';
import { HStack } from '@astryxdesign/core/Stack';
import { Text } from '@astryxdesign/core/Text';
import { Token } from '@astryxdesign/core/Token';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useApiMutation, useForget } from '../../lib/data';
import { formatDateTime, formatNumber, plural } from '../../lib/format';
import { Mono } from '../../lib/Mono';
import { AUDIT_PREFIX, regenerateSummary, setSummaryHidden, SUMMARIES_PATH } from './api';
import {
  SUMMARY_CONFIDENCES,
  SUMMARY_LEVELS,
  SUMMARY_SCALE_VALUES,
  SUMMARY_SCALES,
  SUMMARY_STATUSES,
  summaryTagLabel,
} from './labels';
import type { TeacherSummary, TeacherSummaryRow } from './types';

/** The backend builds a summary from at least this many reviews. */
const MIN_REVIEWS = 3;
const ERRORS = {
  not_found: 'Сводка не найдена',
  business_rule_violation: 'Сейчас пересчитать нельзя',
};
/** Counters, the table and the audit change with a row, whether the change went through or not. */
const FORGETS = [SUMMARIES_PATH, AUDIT_PREFIX];

interface Props {
  row: TeacherSummaryRow;
  /** Summaries are on at the server. */
  isEnabled: boolean;
  onClose: () => void;
}

/**
 * One teacher's summary. It starts from the row of the table and shows the row each change answers,
 * so it stays open when the change takes the teacher out of the filtered table.
 */
export function SummaryDialog({ row: initial, isEnabled, onClose }: Props) {
  const [row, setRow] = useState(initial);
  const forget = useForget();
  const status = SUMMARY_STATUSES[row.status];
  const canRegenerate = isEnabled && !row.hidden && row.inputCount >= MIN_REVIEWS;
  const forgetAll = () => FORGETS.forEach((prefix) => void forget(prefix));

  const hide = useApiMutation({
    run: (hidden: boolean) => setSummaryHidden(row.teacherIsu, hidden),
    forgets: FORGETS,
    done: (answer) => (answer.hidden ? 'Сводка скрыта' : 'Сводка показана'),
    failed: row.hidden ? 'Не удалось показать сводку' : 'Не удалось скрыть сводку',
    errors: ERRORS,
  });
  const regenerate = useApiMutation({
    run: () => regenerateSummary(row.teacherIsu),
    forgets: FORGETS,
    done: 'Пересчёт запрошен',
    failed: 'Не удалось пересчитать сводку',
    errors: ERRORS,
  });
  const isBusy = hide.isPending || regenerate.isPending;

  return (
    <Dialog isOpen onOpenChange={(isOpen) => !isOpen && onClose()} purpose="info" width={640}>
      <Layout
        header={
          <DialogHeader
            title={row.teacherName ?? `ИСУ ${row.teacherIsu}`}
            subtitle={row.teacherName ? `ИСУ ${row.teacherIsu}` : undefined}
            onOpenChange={(isOpen) => !isOpen && onClose()}
          />
        }
        content={
          <LayoutContent isScrollable>
            <div className="reviews-summary">
              <div className="reviews-line">
                <Token size="sm" color={status.color} label={status.label} />
                <Text type="body">Отзывов сейчас: {formatNumber(row.inputCount)}</Text>
                {row.hiddenAt ? (
                  <Text type="body" color="secondary">
                    {row.hiddenByName ? `Скрыл ${row.hiddenByName}` : 'Скрыта'} ·{' '}
                    {formatDateTime(row.hiddenAt)}
                  </Text>
                ) : null}
              </div>
              {row.lastError ? (
                <div className="reviews-line">
                  <Mono tone="error">{row.lastError}</Mono>
                  <Text type="supporting" color="secondary">
                    Попыток: {formatNumber(row.attempts)}
                    {row.lastAttemptAt ? ` · ${formatDateTime(row.lastAttemptAt)}` : ''}
                  </Text>
                </div>
              ) : null}
              {row.summary ? (
                <Summary summary={row.summary} />
              ) : (
                <Text color="secondary">Сводки ещё нет</Text>
              )}
            </div>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end" wrap="wrap">
              <Button
                label={row.hidden ? 'Показать' : 'Скрыть'}
                icon={row.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                variant="secondary"
                isDisabled={isBusy}
                isLoading={hide.isPending}
                onClick={() => hide.mutate(!row.hidden, { onSuccess: setRow, onError: forgetAll })}
              />
              <Button
                label="Пересчитать"
                icon={<RefreshCw size={16} />}
                variant="primary"
                isDisabled={isBusy || !canRegenerate}
                isLoading={regenerate.isPending}
                onClick={() =>
                  regenerate.mutate(undefined, { onSuccess: setRow, onError: forgetAll })
                }
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

/** Texts come from the model and are rendered as text only: no HTML, no links. */
function Summary({ summary }: { summary: TeacherSummary }) {
  const points = [
    { title: 'Плюсы', items: summary.pros },
    { title: 'Минусы', items: summary.cons },
  ];
  return (
    <>
      <Text type="supporting" color="secondary">
        Сводка по {formatNumber(summary.reviewCount)}{' '}
        {plural(summary.reviewCount, ['отзыву', 'отзывам', 'отзывам'])} · ИИ ·{' '}
        {formatDateTime(summary.generatedAt)}
      </Text>
      <Text type="large">
        Тон: {SUMMARY_LEVELS[summary.level]}
        <span className="reviews-muted">
          {' '}
          · уверенность {SUMMARY_CONFIDENCES[summary.confidence]}
        </span>
      </Text>
      <p className="reviews-text">{summary.description}</p>
      {points.map(({ title, items }) =>
        items.length > 0 ? (
          <section key={title} className="reviews-points" aria-label={title}>
            <Text type="label" weight="semibold">
              {title}
            </Text>
            <ul>
              {items.map((item, index) => (
                // Points have no identity of their own and never reorder within one summary.
                <li key={index} className="reviews-text">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {summary.tags.length > 0 ? (
        <ul className="reviews-tags" aria-label="Теги">
          {summary.tags.map((tag) => (
            <li key={tag}>
              <Token size="sm" label={summaryTagLabel(tag)} />
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="reviews-scales" aria-label="Шкалы">
        {summary.scales.map((scale) => (
          <div key={scale.kind}>
            <dt>{SUMMARY_SCALES[scale.kind]}</dt>
            <dd>
              {SUMMARY_SCALE_VALUES[scale.kind][scale.value]}
              {scale.reason ? <span className="reviews-muted"> · {scale.reason}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
