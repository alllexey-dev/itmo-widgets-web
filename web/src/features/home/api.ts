import { api } from '../../api/client';
import type {
  AiSummaries,
  CasePage,
  Dashboard,
  ReviewsSync,
  ServiceCredential,
  SportStatus,
} from './types';

/** A data source of Главная: the request and the key of its cached answer. */
export interface Source<T> {
  key: string;
  fetch: () => Promise<T>;
}

const get = <T>(path: string): Source<T> => ({ key: path, fetch: () => api.get<T>(path) });

/** Open cases, oldest first; a one-item page is enough for the total. */
export const openCases: Source<CasePage> = {
  key: '/api/admin/moderation/cases?status=OPEN&page=0&size=1',
  fetch: () =>
    api.get<CasePage>('/api/admin/moderation/cases', {
      query: { status: 'OPEN', page: 0, size: 1 },
    }),
};
export const credentials = get<ServiceCredential[]>('/api/admin/system/credentials');
export const sport = get<SportStatus>('/api/admin/system/sport');
export const aiSummaries = get<AiSummaries>('/api/admin/reviews/summaries');
export const reviewsSync = get<ReviewsSync>('/api/admin/reviews/sync');
export const dashboard = get<Dashboard>('/api/admin/dashboard');
