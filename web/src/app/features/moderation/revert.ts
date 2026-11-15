import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useApiMutation, useForget } from '../../lib/data';
import { useNotify } from '../../lib/notify';
import { casePath, DECISION_FORGETS, MODERATION, revertDecision } from './api';
import {
  REVERT_DENIED,
  REVERT_FAILED,
  revertedText,
  revertRefusalText,
  type RevertRefusal,
} from './labels';
import type { ModerationCase, ModerationDecision, TargetType } from './types';

/**
 * How far the browser clock may be from Backend's. A refusal this close to the end of the window
 * is the window, not a change of the target.
 */
const CLOCK_SLACK = 30_000;

/** Whether Backend offers to take the decision back now, by the browser clock. */
export function canRevert(decision: ModerationDecision, now = Date.now()): boolean {
  return decision.revertibleUntil !== null && now <= Date.parse(decision.revertibleUntil);
}

/**
 * Renders again when the earliest of [instants] passes, so an undo offer disappears when its window
 * ends without a reload. Returns the time of the render.
 */
export function useNowPast(instants: readonly (string | null)[]): number {
  const [now, setNow] = useState(() => Date.now());
  const next = instants
    .map((instant) => (instant ? Date.parse(instant) : Number.NaN))
    .filter((time) => time >= now)
    .sort((a, b) => a - b)[0];
  useEffect(() => {
    if (next === undefined) return;
    const timer = setTimeout(() => setNow(Date.now()), next - Date.now() + 1);
    return () => clearTimeout(timer);
  }, [next]);
  return now;
}

/**
 * Backend refuses every revert with the same `business_rule_violation`. The case read again tells
 * most reasons apart; what it cannot tell (an edit by the author, another open case, a decision on
 * another case that touched the target) is said together.
 */
function refusalOf(fresh: ModerationCase, decision: ModerationDecision): RevertRefusal {
  const found = fresh.decisions.find((item) => item.id === decision.id);
  if (found?.revertedAt) return 'reverted';
  if (found && fresh.decisions.at(-1)?.id !== found.id) return 'newer';
  const until = decision.revertibleUntil ? Date.parse(decision.revertibleUntil) : 0;
  if (Date.now() >= until - CLOCK_SLACK) return 'expired';
  if (!fresh.target) return 'deleted';
  return 'changed';
}

async function refusalText(
  error: unknown,
  caseId: string,
  targetType: TargetType,
  decision: ModerationDecision,
): Promise<string> {
  if (!(error instanceof ApiError)) return REVERT_FAILED;
  if (error.code === 'permission_denied') return REVERT_DENIED;
  if (error.code !== 'business_rule_violation') return REVERT_FAILED;
  try {
    const fresh = await api.get<ModerationCase>(casePath(caseId));
    return revertRefusalText(refusalOf(fresh, decision), targetType);
  } catch {
    return REVERT_FAILED;
  }
}

export interface RevertRequest {
  caseId: string;
  targetType: TargetType;
  decision: ModerationDecision;
}

/**
 * Takes a decision back. On success the toast says where the case is now and the queue, the case,
 * the counters and the audit reload; a refusal is said in words and reloads them too, since the
 * case has changed under the moderator. Resolves with the case as Backend left it, or null.
 */
export function useRevert() {
  const notify = useNotify();
  const forget = useForget();
  const mutation = useApiMutation({
    run: ({ caseId, decision }: RevertRequest) => revertDecision(caseId, decision.id),
    forgets: DECISION_FORGETS,
    done: revertedText,
  });

  async function run(request: RevertRequest): Promise<ModerationCase | null> {
    try {
      return await mutation.mutateAsync(request);
    } catch (error) {
      notify.error(await refusalText(error, request.caseId, request.targetType, request.decision));
      await forget(MODERATION);
      return null;
    }
  }

  return {
    run,
    /** The decision being taken back, while it is. */
    pendingId: mutation.isPending ? (mutation.variables?.decision.id ?? null) : null,
  };
}
