import { useCallback, useEffect, useRef, useState } from 'react';
import { listAllTasks } from './tasks.service';
import type { Task } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';

export type LoadProgress = {
  /** Pagina que esta sendo buscada agora. */
  page: number;
  /** Ultima pagina que sera lida (ja limitada pelo teto do quadro). */
  totalPages: number;
};

/**
 * Tarefas do projeto para o quadro Kanban (D-012), ate o teto de 5.000 (KAN-15).
 * Le as paginas do backend e entrega um array unico, sem paginacao na tela.
 * `search` filtra no servidor (titulo e descricao), igual a lista.
 * `progress` indica a pagina em andamento quando ha varias; `loaded` fica true depois da primeira
 * resposta (os recarregamentos seguintes mantem o quadro na tela em vez de voltar ao esqueleto).
 * `truncated` avisa que havia mais tarefas do que o teto (so as mais recentes vieram).
 */
export function useAllTasks(projectId: string | undefined, assigneeId: string, search?: string) {
  const [data, setData] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);
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
    setProgress(null);

    try {
      const result = await listAllTasks(
        projectId,
        { assigneeId: assigneeId || undefined, search },
        (page, totalPages) => {
          if (id === requestId.current) {
            setProgress({ page, totalPages });
          }
        },
      );

      if (id !== requestId.current) return;

      setData(result.tasks);
      setTotal(result.total);
      setTruncated(result.truncated);
      setLoaded(true);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err, 'Não foi possível carregar as tarefas.'));
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setProgress(null);
      }
    }
  }, [projectId, assigneeId, search]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- busca de dados ao montar e ao trocar o filtro (D-007).
    void reload();
  }, [reload]);

  return { data, total, truncated, loading, loaded, error, progress, reload };
}
