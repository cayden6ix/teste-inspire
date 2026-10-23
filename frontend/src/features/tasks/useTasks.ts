import { useCallback, useEffect, useRef, useState } from 'react';
import { listTasks } from './tasks.service';
import type { Task, TaskFilters } from '@/types/task';
import { DEFAULT_PAGE_LIMIT } from '@/types/pagination';
import type { PaginationMeta } from '@/types/pagination';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Tarefas do projeto, paginadas, com filtros de servidor (busca, status, responsavel e prazo).
 * A lista vem da mais recente para a mais antiga. Quem muda um filtro deve voltar `page` para 1.
 */
export function useTasks(projectId: string | undefined, filters: TaskFilters) {
  const { search, status, assigneeId, dueFrom, dueTo } = filters;
  const [data, setData] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: DEFAULT_PAGE_LIMIT,
    total: 0,
    totalPages: 0,
  });
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
      const response = await listTasks(projectId, {
        search,
        status,
        assigneeId,
        dueFrom,
        dueTo,
        page,
        limit: DEFAULT_PAGE_LIMIT,
        sortBy: 'createdAt',
        order: 'desc',
      });

      if (id !== requestId.current) return;

      if (response.meta.totalPages > 0 && page > response.meta.totalPages) {
        setPage(response.meta.totalPages);
        return;
      }

      setData(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err, 'Não foi possível carregar as tarefas.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [projectId, search, status, assigneeId, dueFrom, dueTo, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, meta, page, setPage, loading, error, reload };
}
