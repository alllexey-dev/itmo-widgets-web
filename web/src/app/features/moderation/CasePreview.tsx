import { Button } from '@astryxdesign/core/Button';
import { Token } from '@astryxdesign/core/Token';
import { Tooltip } from '@astryxdesign/core/Tooltip';
import { BadgeCheck, ExternalLink, EyeOff, UserRound } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDateTime, formatRelative } from '../../lib/format';
import { CATEGORIES, hostOf, scoreText, VERIFICATION, visibilityLabel } from './labels';
import type { SubjectLinkTarget, TeacherReviewTarget } from './types';

/** A short label over its value; a row of them wraps into as many columns as fit. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Version({ number, submittedAt }: { number: number; submittedAt: string }) {
  return (
    <Fact label="Версия">
      № {number} · <span title={formatDateTime(submittedAt)}>{formatRelative(submittedAt)}</span>
    </Fact>
  );
}

/** The address with the host standing out: that is what tells a table from a phishing page. */
function Address({ url }: { url: string }) {
  const host = hostOf(url);
  if (!host) return <>{url}</>;
  const [before = '', ...rest] = url.split(host);
  return (
    <>
      <span className="mod-url-rest">{before}</span>
      <span className="mod-url-host">{host}</span>
      <span className="mod-url-rest">{rest.join(host)}</span>
    </>
  );
}

/** The revision under review as the author wrote it. */
export function LinkPreview({ target, hasKeys }: { target: SubjectLinkTarget; hasKeys: boolean }) {
  const { revision, link } = target;
  const category = CATEGORIES[revision.category];
  // The flow name is known only for the link's current flow.
  const audience = revision.flowId === link.flowId ? link.audienceLabel : null;
  return (
    <section className="mod-preview" aria-label="Ссылка">
      <div className="mod-preview-head">
        <div className="mod-preview-text">
          <span className="mod-category">
            <category.icon size={16} aria-hidden />
            {category.label}
          </span>
          <span className="mod-preview-title">{revision.title?.trim() || 'Без названия'}</span>
          <span className="mod-url" title={revision.url}>
            <Address url={revision.url} />
          </span>
        </div>
        <Button
          label="Открыть"
          href={revision.url}
          target="_blank"
          rel="noopener noreferrer"
          icon={<ExternalLink size={16} />}
          aria-keyshortcuts="O"
          endContent={
            hasKeys ? (
              <kbd className="mod-key" aria-hidden>
                O
              </kbd>
            ) : undefined
          }
        />
      </div>
      <dl className="mod-facts">
        <Fact label="Кто видит">{visibilityLabel(revision.visibility, audience)}</Fact>
        <Version number={revision.number} submittedAt={revision.submittedAt} />
        <Fact label="Рейтинг">{scoreText(link.score)}</Fact>
        {link.status === 'HIDDEN' ? (
          <Fact label="Состояние">
            <Token label="Скрыта" color="orange" size="sm" icon={<EyeOff size={14} />} />
          </Fact>
        ) : null}
      </dl>
    </section>
  );
}

/** Moderators see anonymity and the ISU check as facts; the author is shown even when anonymous. */
export function ReviewPreview({ target }: { target: TeacherReviewTarget }) {
  const { revision, review } = target;
  const verification = VERIFICATION[review.verification];
  return (
    <section className="mod-preview" aria-label="Отзыв">
      <div className="mod-tokens">
        <Token
          label={review.anonymous ? 'Анонимно' : 'С именем'}
          size="sm"
          icon={review.anonymous ? <EyeOff size={14} /> : <UserRound size={14} />}
        />
        <Tooltip content={verification.hint}>
          <Token
            label={verification.label}
            description={verification.hint}
            color={verification.color}
            size="sm"
            icon={review.verification === 'VERIFIED' ? <BadgeCheck size={14} /> : undefined}
          />
        </Tooltip>
        {review.hidden ? (
          <Token label="Скрыт" color="orange" size="sm" icon={<EyeOff size={14} />} />
        ) : null}
      </div>
      <p className="mod-review-text">{revision.text}</p>
      <dl className="mod-facts">
        <Fact label="Предмет">{revision.subjectTitle ?? 'Не указан'}</Fact>
        <Version number={revision.number} submittedAt={revision.submittedAt} />
        <Fact label="Рейтинг">{scoreText(review.score)}</Fact>
      </dl>
    </section>
  );
}
