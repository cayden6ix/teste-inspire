import { httpClient } from '@/services/api/httpClient';
import type { Report, ReportGroupBy } from '@/types/report';

/**
 * Relatorios agregados (D-015).
 * `groupBy` aceita `status` ou `user`; `projectId` e opcional e, quando
 * ausente, o relatorio agrega todos os projetos em que o usuario e membro.
 */

export interface ReportParams {
  groupBy: ReportGroupBy;
  projectId?: string;
}

export async function getReport(params: ReportParams): Promise<Report> {
  const { data } = await httpClient.get<Report>('/reports', { params });
  return data;
}
