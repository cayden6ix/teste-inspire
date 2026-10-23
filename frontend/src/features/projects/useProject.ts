import { useCallback, useEffect, useState } from 'react';
import { getProject } from './projects.service';
import type { Project } from '@/types/project';
import { useRequestGuard } from '@/hooks/useRequestGuard';
import { errorMessage, isRetryableError } from '@/utils/errorMessage';

/**
 * Detalhe de um projeto no contexto em que as tarefas existem (D-011), com o papel do usuario.
 * `retryable` diz se o erro e passageiro (rede, 5xx: vale "Tentar novamente") ou definitivo
 * (404/403/400: o projeto nao existe ou nao e da pessoa).
 */
export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
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
      setRetryable(isRetryableError(err));
    } finally {
      if (guard.isCurrent(id)) setLoading(false);
    }
  }, [projectId, guard]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- busca de dados ao montar (D-007): o estado de carregamento acompanha a requisição.
    void reload();
  }, [reload]);

  return { project, loading, error, retryable, reload };
}
