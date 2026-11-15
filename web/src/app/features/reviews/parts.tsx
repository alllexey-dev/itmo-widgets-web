// The state of a background job, shared by the cards of the reviews page.
import { StatusDot } from '@astryxdesign/core/StatusDot';
import { Text } from '@astryxdesign/core/Text';
import type { ReactNode } from 'react';
import type { Health } from './labels';
import './reviews.css';

/**
 * The headline state of a background job with what is known about its last run. The dot pulses
 * while the job runs; it never carries the meaning alone.
 */
export function RunState({
  health,
  isRunning,
  children,
}: {
  health: Health;
  isRunning: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="reviews-state">
      <span className="reviews-health">
        <StatusDot variant={health.tone} label={health.label} isPulsing={isRunning} />
        <Text type="body" weight="medium">
          {health.label}
        </Text>
      </span>
      {children}
    </div>
  );
}
