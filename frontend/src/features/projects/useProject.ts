import { useCallback, useEffect, useState } from 'react';
import { getProject } from './projects.service';
import type { Project } from '@/types/project';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Detalhe de um projeto no contexto em que as tarefas existem (D-011).
 */
export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setProject(await getProject(projectId));
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar o projeto.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { project, loading, error, reload };
}
