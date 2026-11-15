import type { components } from '../../api/schema';
import type { ClientKind } from '../../lib/clients';

type Schemas = components['schemas'];

export type TabId = 'overview' | 'audience' | 'features' | 'sport' | 'reviews' | 'system';

export type Dashboard = Schemas['AdminDashboard'];
export type DashboardDay = Schemas['AdminDashboardDay'];
export type DayMetric = Exclude<keyof DashboardDay, 'date'>;
export type LinkStatus = Schemas['SubjectLink']['status'];
export type DevicePlatform = Schemas['AdminClientBuild']['platform'];

export type Clients = Schemas['AdminClients'];
export type ClientKindStats = Schemas['AdminClientKind'];
export type ClientDay = Schemas['AdminClientDay'];
export type ClientVersions = Schemas['AdminClientVersions'];
export type AppVersion = Schemas['AdminAppVersion'];
/** One client kind, or every kind together. */
export type ClientFilter = 'all' | ClientKind;

export type SportStatus = Schemas['AdminSportStatus'];
export type SportRun = Schemas['AdminSportRun'];
export type SportOutcome = SportRun['outcome'];
export type SportError = NonNullable<SportRun['errorCategory']>;

export type ReviewVerification = Schemas['AdminReviewVerification'];
export type ReviewsSync = Schemas['AdminReviewsSync'];
export type AiSummaries = Schemas['AdminAiSummaries'];

export type CaseItem = Schemas['AdminCaseItem'];
export type CasesPage = Schemas['AdminPageAdminCaseItem'];
export type CaseReason = CaseItem['reason'];
export type CaseTarget = CaseItem['targetType'];
export type Restriction = Schemas['AdminRestriction'];
export type RestrictionsPage = Schemas['AdminPageAdminRestriction'];
export type Capability = Restriction['capability'];

export type Credential = Schemas['AdminServiceCredential'];
