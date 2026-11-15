import type { components } from '../../api/schema';

type Schemas = components['schemas'];

/** Open cases come oldest first; only the total and the first item's `openedAt` are read. */
export type CasePage = Pick<Schemas['AdminPageAdminCaseItem'], 'total'> & {
  items: Pick<Schemas['AdminCaseItem'], 'openedAt'>[];
};
export type ServiceCredential = Schemas['AdminServiceCredential'];
export type CredentialKey = ServiceCredential['key'];
export type SportStatus = Schemas['AdminSportStatus'];
export type AiSummaries = Schemas['AdminAiSummaries'];
export type ReviewsSync = Schemas['AdminReviewsSync'];
export type Dashboard = Schemas['AdminDashboard'];
export type DashboardDay = Schemas['AdminDashboardDay'];
export type SportStats = Schemas['AdminSportStats'];
export type ServerStats = Schemas['AdminServerStats'];

export type UserData = Schemas['UserData'];
/** Capabilities can be missing from an older answer; a missing one is a denied one. */
export type UserProfile = Omit<Schemas['UserProfile'], 'user'> & {
  user: Omit<UserData, 'capabilities'> & {
    capabilities?: Partial<Schemas['UserCapabilities']> | null;
  };
};
export type Lesson = Schemas['LessonDto'];
/** A friend with a lesson on the asked day and the lessons of that day, ordered by start. */
export type FriendDay = Schemas['FriendDay'];

export type SportLesson = Schemas['SportLessonDto'];
export type QueueEntry = Schemas['SportAutoSignEntry'] | Schemas['SportFreeSignEntry'];
export type SportSection = Schemas['MySportSection'];
export type SectionDate = Schemas['SportSectionDate'];

export type Devices = Schemas['UserDevices'];
export type Connection = Schemas['ConnectionInfo'];
export type Install = Schemas['InstallInfo'];
