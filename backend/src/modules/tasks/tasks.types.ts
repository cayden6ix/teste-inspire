import { SortOrder } from '../../common/enums/sort-order.enum.js';
import { TaskStatus } from '../../common/enums/task-status.enum.js';

/**
 * Tipos de dominio de tarefas, compartilhados pelo DTO HTTP e pelo repository
 * (a camada de persistencia nao depende de DTOs).
 */
export type TaskSortField = 'title' | 'status' | 'dueDate' | 'createdAt' | 'updatedAt';

export const TASK_SORT_FIELDS: TaskSortField[] = [
  'title',
  'status',
  'dueDate',
  'createdAt',
  'updatedAt',
];

export interface TaskPageFilters {
  status?: TaskStatus;
  assigneeId?: string;
  search?: string;
  dueFrom?: string;
  dueTo?: string;
}

export interface TaskPageSort {
  sortBy: TaskSortField;
  order: SortOrder;
}

/** Contagem de tarefas por status (relatorios, D-015). */
export interface TaskStatusCount {
  status: TaskStatus;
  count: number;
}

/** Contagem de tarefas por responsavel; `assigneeId` nulo = sem responsavel. */
export interface TaskAssigneeCount {
  assigneeId: string | null;
  assigneeName: string | null;
  count: number;
}

/** Limites de texto da tarefa, os mesmos na API (DTOs) e na importacao CSV. */
export const TASK_TITLE_MAX_LENGTH = 200;

export const TASK_DESCRIPTION_MAX_LENGTH = 4000;
