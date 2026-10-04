import type { LinkStatus } from '../../api/admin';
import type { components } from '../../api/schema';

type Schemas = components['schemas'];

export type DashboardTotals = Omit<Schemas['AdminDashboardTotals'], 'links'> & {
  links: Record<LinkStatus, number>;
};
export type DashboardDay = Schemas['AdminDashboardDay'];
export type Dashboard = Omit<Schemas['AdminDashboard'], 'totals'> & { totals: DashboardTotals };
export type DayMetric = Exclude<keyof DashboardDay, 'date'>;
