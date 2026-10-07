import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type Dashboard = Schemas['AdminDashboard'];
export type DashboardTotals = Schemas['AdminDashboardTotals'];
export type DashboardDay = Schemas['AdminDashboardDay'];
export type DayMetric = Exclude<keyof DashboardDay, 'date'>;
export type LinkStatus = Schemas['SubjectLink']['status'];
