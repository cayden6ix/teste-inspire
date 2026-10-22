import { useCallback, useEffect, useState } from 'react';
import { listTasks } from './tasks.service';
import type { Task, TaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';

/**
 * Tarefas do projeto, com filtros de status e responsavel (D-011, D-012).
 */
export function useTasks(
  projectId: string | undefined,
  status: TaskStatus | '',
  assigneeId: string,
) {
  const [tasks, setTasks] = useState<Task[]>([]);
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
      const filters: { status?: TaskStatus; assigneeId?: string } = {};
      if (status) filters.status = status;
      if (assigneeId) filters.assigneeId = assigneeId;

      setTasks(await listTasks(projectId, filters));
    } catch (err) {
      setError(errorMessage(err, 'Nao foi possivel carregar as tarefas.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, status, assigneeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { tasks, loading, error, reload };
}
