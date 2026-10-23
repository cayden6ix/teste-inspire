import { TASK_STATUSES } from '@/types/task';
import type { Task, TaskStatus } from '@/types/task';

/** Cartoes renderizados por coluna de cada vez; "Mostrar mais" soma outros tantos (KAN-15). */
export const BOARD_COLUMN_PAGE = 50;

export type BoardColumn = {
  status: TaskStatus;
  /** Todas as tarefas da coluna (a contagem do cabecalho e o total real). */
  tasks: Task[];
};

/**
 * Distribui as tarefas nas colunas por status, aplicando as mudancas otimistas (`moves`) e
 * mantendo as mais recentes primeiro. Uma passada so: com milhares de tarefas, filtrar o array
 * inteiro uma vez por coluna e ordenar com `Date.parse` a cada render pesa na thread.
 */
export function buildColumns(tasks: Task[], moves: Record<string, TaskStatus>): BoardColumn[] {
  const byStatus = new Map<TaskStatus, Task[]>(TASK_STATUSES.map((status) => [status, []]));

  for (const task of tasks) {
    const status = moves[task.id] ?? task.status;
    byStatus.get(status)?.push(status === task.status ? task : { ...task, status });
  }

  return TASK_STATUSES.map((status) => ({
    status,
    // createdAt ISO 8601 em UTC: a comparacao de texto ja e cronologica.
    tasks: (byStatus.get(status) ?? []).sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    ),
  }));
}

/** Quantos cartoes da coluna aparecem e quantos ainda faltam para o "Mostrar mais". */
export function columnWindow(total: number, limit: number): { shown: number; remaining: number } {
  const shown = Math.min(total, Math.max(0, limit));
  return { shown, remaining: total - shown };
}

/**
 * Tipo proprio do arraste de cartao. Nao e `text/plain` de proposito: texto arrastado (ex.: uma
 * selecao no campo "Nova tarefa") nao vira movimento de cartao, e o navegador nao insere o id da
 * tarefa num campo de texto quando o cartao e solto sobre ele.
 */
export const TASK_DRAG_TYPE = 'application/x-task-id';

/** O arraste em andamento e de um cartao do quadro? (os tipos ficam visiveis no dragover). */
export function isTaskDrag(types: readonly string[]): boolean {
  return types.includes(TASK_DRAG_TYPE);
}

/**
 * O `dragleave` saiu mesmo da coluna? Ele tambem dispara ao passar de um filho para outro
 * (cabecalho -> campo -> lista); so desliga o realce quando o destino esta fora da coluna.
 */
export function leftColumn(column: Pick<Node, 'contains'>, related: Node | null): boolean {
  return related === null || !column.contains(related);
}
