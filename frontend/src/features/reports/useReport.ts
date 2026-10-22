import { useCallback, useEffect, useState } from 'react';
import { getReport } from './reports.service';
import type { Report, ReportGroupBy } from '@/types/report';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Relatorio agregado (D-015).
 * Sem `projectId`, o relatorio agrega todos os projetos do usuario.
 */
export function useReport(groupBy: ReportGroupBy, projectId: string) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setReport(await getReport(projectId ? { groupBy, projectId } : { groupBy }));
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar o relatorio.'));
    } finally {
      setLoading(false);
    }
  }, [groupBy, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { report, loading, error, reload };
}
