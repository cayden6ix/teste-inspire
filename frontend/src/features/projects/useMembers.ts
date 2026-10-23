import { useCallback, useEffect, useRef, useState } from 'react';
import { listMembers } from './projects.service';
import type { ProjectMember, ProjectRole } from '@/types/project';
import { DEFAULT_PAGE_LIMIT } from '@/types/pagination';
import type { PaginationMeta } from '@/types/pagination';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Membros do projeto com seus papeis (D-013), paginados.
 * Selects de responsavel usam `limit = MAX_PAGE_LIMIT` para receber todos.
 * `role` filtra no servidor; quem o muda deve voltar `page` para 1.
 */
export function useMembers(
  projectId: string | undefined,
  limit = DEFAULT_PAGE_LIMIT,
  role?: ProjectRole,
) {
  const [data, setData] = useState<ProjectMember[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** So a resposta da requisicao mais recente pode atualizar o estado. */
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    if (!projectId) {
      requestId.current += 1;
      setLoading(false);
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const response = await listMembers(projectId, { page, limit, role });

      if (id !== requestId.current) return;

      if (response.meta.totalPages > 0 && page > response.meta.totalPages) {
        setPage(response.meta.totalPages);
        return;
      }

      setData(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err, 'Não foi possível carregar os membros.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId, page, limit, role]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- busca de dados ao montar e ao trocar filtro ou pagina (D-007).
    void reload();
  }, [reload]);

  return { data, meta, page, setPage, loading, error, reload };
}
