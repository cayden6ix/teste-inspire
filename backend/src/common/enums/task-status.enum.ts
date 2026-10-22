/**
 * Status possiveis de uma tarefa (D-012).
 *
 * `pendente` -> `em_andamento` -> `concluida`.
 */
export enum TaskStatus {
  Pendente = 'pendente',
  EmAndamento = 'em_andamento',
  Concluida = 'concluida',
}

export const TASK_STATUS_VALUES: TaskStatus[] = [
  TaskStatus.Pendente,
  TaskStatus.EmAndamento,
  TaskStatus.Concluida,
];
