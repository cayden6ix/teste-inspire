import { useCallback, useEffect, useState } from 'react';
import { listMembers } from './projects.service';
import type { ProjectMember } from '@/types/project';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Membros do projeto com seus papeis (D-013).
 */
export function useMembers(projectId: string | undefined) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
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
      setMembers(await listMembers(projectId));
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar os membros.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { members, loading, error, reload };
}
