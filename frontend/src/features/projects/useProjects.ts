import { useCallback, useEffect, useRef, useState } from 'react';
import { listProjects } from './projects.service';
import type { Project } from '@/types/project';
import { DEFAULT_PAGE_LIMIT } from '@/types/pagination';
import type { PaginationMeta } from '@/types/pagination';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Projetos do usuario, paginados (cache em memoria no proprio hook, D-007).
 * `search` filtra no servidor; quem o muda deve voltar `page` para 1.
 */
export function useProjects(limit = DEFAULT_PAGE_LIMIT, search?: string) {
  const [data, setData] = useState<Project[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** So a resposta da requisicao mais recente pode atualizar o estado. */
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects({ page, limit, search });

      if (id !== requestId.current) return;

      if (response.meta.totalPages > 0 && page > response.meta.totalPages) {
        setPage(response.meta.totalPages);
        return;
      }

      setData(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err, 'Não foi possível carregar os projetos.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- busca de dados ao montar e ao trocar filtro ou pagina (D-007).
    void reload();
  }, [reload]);

  return { data, meta, page, setPage, loading, error, reload };
}
