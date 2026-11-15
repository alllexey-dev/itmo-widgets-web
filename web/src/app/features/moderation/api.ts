import { api } from '../../api/client';
import type { DecisionRequest, ModerationCase } from './types';

/** Cache keys are request paths, so forgetting this prefix refreshes both pages and the navigation badge. */
export const MODERATION = '/api/admin/moderation';
export const CASES_PATH = `${MODERATION}/cases`;
export const RESTRICTIONS_PATH = `${MODERATION}/restrictions`;
export const QUEUE_PAGE_SIZE = 25;
export const RESTRICTIONS_PAGE_SIZE = 20;

export function casePath(id: string): string {
  return `${CASES_PATH}/${encodeURIComponent(id)}`;
}

export function decide(caseId: string, request: DecisionRequest): Promise<ModerationCase> {
  return api.post<ModerationCase>(`${casePath(caseId)}/decisions`, request);
}

/** Takes a decision back within its window (`ModerationDecision.revertibleUntil`). */
export function revertDecision(caseId: string, decisionId: string): Promise<ModerationCase> {
  return api.post<ModerationCase>(
    `${casePath(caseId)}/decisions/${encodeURIComponent(decisionId)}/revert`,
  );
}

export function revokeRestriction(id: string): Promise<null> {
  return api.post<null>(`${RESTRICTIONS_PATH}/${encodeURIComponent(id)}/revoke`);
}

/** A decision and its revert change the queue, the case, the restrictions and the audit log. */
export const DECISION_FORGETS = [MODERATION, '/api/admin/audit'] as const;

/** Revoking also changes user cards, which list restrictions too. */
export const REVOKE_FORGETS = [MODERATION, '/api/admin/users', '/api/admin/audit'] as const;
