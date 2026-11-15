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

// The statistics of a period (`/api/admin/stats/*`) and the state of the sheet rules.

export type AudienceStats = Omit<Schemas['AdminAudienceStats'], 'retentionClassic'> & {
  retentionClassic: ClassicCohort[];
};
export type AudienceDay = Schemas['AdminAudienceDay'];
export type PeopleDay = Schemas['AdminPeopleDay'];
export type RetentionCohort = Schemas['AdminRetentionCohort'];
/** The snapshot says `number[]`; the contract has null for a week before activity was collected. */
export type ClassicCohort = Omit<Schemas['AdminClassicCohort'], 'active'> & {
  active: (number | null)[];
};
export type FacultyCount = Schemas['AdminFacultyCount'];
export type CourseCount = Schemas['AdminCourseCount'];

export type FeatureStats = Schemas['AdminFeatureStats'];
export type FeatureUsage = Schemas['AdminFeatureUsage'];
export type FeatureDay = Schemas['AdminFeatureStatsDay'];
export type PairingFunnel = Schemas['AdminPairingFunnel'];

export type SportStats = Schemas['AdminSportStats'];
export type SportStatsDay = Schemas['AdminSportStatsDay'];
export type SportEntryStats = Schemas['AdminSportEntryStats'];
export type SportSectionStats = Schemas['AdminSportSectionStats'];
export type SportSlotStats = Schemas['AdminSportSlotStats'];

export type ModerationStats = Schemas['AdminModerationStats'];
export type ModerationDay = Schemas['AdminModerationStatsDay'];
export type DecisionStats = Schemas['AdminDecisionStats'];
export type ReportStats = Schemas['AdminReportStats'];

export type ServerStats = Schemas['AdminServerStats'];
export type ServerDay = Schemas['AdminServerDay'];
export type RouteStats = Schemas['AdminRouteStats'];

export type SheetRules = Schemas['AdminSheetRules'];
