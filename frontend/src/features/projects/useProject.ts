import { useCallback, useEffect, useState } from 'react';
import { getProject } from './projects.service';
import type { Project } from '@/types/project';
import { useRequestGuard } from '@/hooks/useRequestGuard';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Detalhe de um projeto no contexto em que as tarefas existem (D-011).
 */
export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Só a resposta da requisição mais recente pode atualizar o estado. */
  const guard = useRequestGuard();

  const reload = useCallback(async () => {
    if (!projectId) {
      guard.cancel();
      setLoading(false);
      return;
    }

    const id = guard.next();
    setLoading(true);
    setError(null);

    try {
      const loaded = await getProject(projectId);
      if (guard.isCurrent(id)) setProject(loaded);
    } catch (err) {
      if (!guard.isCurrent(id)) return;
      setError(errorMessage(err, 'Não foi possível carregar o projeto.'));
    } finally {
      if (guard.isCurrent(id)) setLoading(false);
    }
  }, [projectId, guard]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { project, loading, error, reload };
}
