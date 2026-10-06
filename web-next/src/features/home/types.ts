import type { components } from '../../api/schema';

type Schemas = components['schemas'];

/** Only `total` of a one-item page of open cases is read. */
export type CasePage = Pick<Schemas['AdminPageAdminCaseItem'], 'total'>;
export type ServiceCredential = Schemas['AdminServiceCredential'];
export type CredentialKey = ServiceCredential['key'];
export type SportStatus = Schemas['AdminSportStatus'];
export type AiSummaries = Schemas['AdminAiSummaries'];
export type ReviewsSync = Schemas['AdminReviewsSync'];
export type DashboardTotals = Schemas['AdminDashboardTotals'];
export type Dashboard = Schemas['AdminDashboard'];
