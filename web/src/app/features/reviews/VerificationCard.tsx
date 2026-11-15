import { useApiQuery } from '../../lib/data';
import { formatNumber } from '../../lib/format';
import { Loadable } from '../../lib/Loadable';
import { Panel } from '../../lib/Panel';
import { Stat, Stats } from '../../lib/Stats';
import { VERIFICATION_PATH } from './api';
import { REVIEW_CHECK_LABEL, REVIEW_CHECK_NAME } from './labels';
import type { ReviewVerificationCounts } from './types';

/** Whether the teacher taught the author of the review, checked against ISU. */
export function VerificationCard() {
  const verification = useApiQuery<ReviewVerificationCounts>(VERIFICATION_PATH);
  return (
    <Panel body="content" title={REVIEW_CHECK_NAME} hint="Вёл ли преподаватель у автора отзыва">
      <Loadable
        resource={verification}
        label="Загружаем проверку"
        errorTitle="Не удалось загрузить проверку"
        isCompact
      >
        {(counts) => (
          <Stats>
            <Stat label={REVIEW_CHECK_LABEL.pending} value={formatNumber(counts.pending)} />
            <Stat label={REVIEW_CHECK_LABEL.verified} value={formatNumber(counts.verified)} />
            <Stat label={REVIEW_CHECK_LABEL.unverified} value={formatNumber(counts.unverified)} />
          </Stats>
        )}
      </Loadable>
    </Panel>
  );
}
