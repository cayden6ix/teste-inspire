import { useCallback, useEffect, useState } from 'react';
import { getReport } from './reports.service';
import type { Report, ReportGroupBy } from '@/types/report';
import { useRequestGuard } from '@/hooks/useRequestGuard';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Relatório agregado (D-015).
 * Sem `projectId`, o relatório agrega todos os projetos do usuário.
 */
export function useReport(groupBy: ReportGroupBy, projectId: string) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Só a resposta da requisição mais recente pode atualizar o estado. */
  const guard = useRequestGuard();

  const reload = useCallback(async () => {
    const id = guard.next();
    setLoading(true);
    setError(null);

    try {
      const loaded = await getReport(projectId ? { groupBy, projectId } : { groupBy });
      if (guard.isCurrent(id)) setReport(loaded);
    } catch (err) {
      if (!guard.isCurrent(id)) return;
      setError(errorMessage(err, 'Não foi possível carregar o relatório.'));
    } finally {
      if (guard.isCurrent(id)) setLoading(false);
    }
  }, [groupBy, projectId, guard]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { report, loading, error, reload };
}
