import { useCallback, useEffect, useState } from 'react';
import { listProjects } from './projects.service';
import type { Project } from '@/types/project';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Lista de projetos do usuario (cache em memoria no proprio hook, D-007).
 */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setProjects(await listProjects());
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar os projetos.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { projects, loading, error, reload };
}
