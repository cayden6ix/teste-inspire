/**
 * Tipos dos relatorios agregados (D-015).
 */

import type { TaskStatus } from './task';

export type ReportGroupBy = 'status' | 'user';

export const REPORT_GROUP_BY_LABELS: Record<ReportGroupBy, string> = {
  status: 'Por status',
  user: 'Por responsável',
};

export interface ReportGroup {
  key: string;
  label: string;
  count: number;
}

export interface Report {
  groupBy: ReportGroupBy;
  total: number;
  byStatus: Record<TaskStatus, number>;
  groups: ReportGroup[];
}
