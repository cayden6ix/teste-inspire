/**
 * Tipos de tarefa (D-011 e D-012).
 *
 * Toda tarefa pertence a um projeto e so e acessada no contexto dele.
 */

export type TaskStatus = 'pendente' | 'em_andamento' | 'concluida';

export const TASK_STATUSES: TaskStatus[] = ['pendente', 'em_andamento', 'concluida'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
};

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
  /** Busca parcial no titulo e na descricao, feita no servidor. */
  search?: string;
  /** Prazo a partir de (AAAA-MM-DD). */
  dueFrom?: string;
  /** Prazo ate (AAAA-MM-DD). */
  dueTo?: string;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  created: number;
  errors: ImportError[];
}
