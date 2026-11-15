import { VStack } from '@astryxdesign/core/Stack';
import { useEffect, useRef } from 'react';
import { useApiQuery, useForget } from '../../lib/data';
import { PageHeader } from '../../lib/PageHeader';
import { SUMMARIES_PATH, TEACHERS_PATH, whileRunning } from './api';
import './reviews.css';
import { SummariesCard } from './SummariesCard';
import { SummariesTable } from './SummariesTable';
import { SyncCard } from './SyncCard';
import type { AiSummariesState } from './types';
import { VerificationCard } from './VerificationCard';

/** Отзывы: the copy of teacher reviews, their ISU check and the AI summaries built from them. */
export default function ReviewsPage() {
  // The AI state is shared by its card and the teachers table.
  const summaries = useApiQuery<AiSummariesState>(SUMMARIES_PATH, undefined, {
    poll: whileRunning,
  });
  const isRunning = summaries.data?.running ?? false;

  // A run changes the statuses, so the table loads again once the run ends.
  const forget = useForget();
  const wasRunning = useRef(isRunning);
  useEffect(() => {
    if (wasRunning.current && !isRunning) void forget(TEACHERS_PATH);
    wasRunning.current = isRunning;
  }, [isRunning, forget]);

  return (
    <VStack gap={6}>
      <PageHeader title="Отзывы" text="Отзывы из проекта Reviews, проверка по ИСУ и ИИ-сводки" />
      <VStack gap={4}>
        <div className="reviews-columns">
          <SyncCard />
          <VerificationCard />
        </div>
        <SummariesCard summaries={summaries} />
        <SummariesTable isEnabled={summaries.data?.enabled ?? false} />
      </VStack>
    </VStack>
  );
}
