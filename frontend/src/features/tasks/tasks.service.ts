import { httpClient } from '@/services/api/httpClient';
import type { ImportResult, Task, TaskFilters, TaskInput } from '@/types/task';

/**
 * Tarefas (D-011, D-012) e CSV (D-014).
 * Toda rota de tarefa e aninhada no projeto: a tarefa nao existe fora dele.
 */

export async function listTasks(projectId: string, filters: TaskFilters = {}): Promise<Task[]> {
  const { data } = await httpClient.get<Task[]>(`/projects/${projectId}/tasks`, { params: filters });
  return data;
}

export async function getTask(projectId: string, taskId: string): Promise<Task> {
  const { data } = await httpClient.get<Task>(`/projects/${projectId}/tasks/${taskId}`);
  return data;
}

export async function createTask(projectId: string, input: TaskInput): Promise<Task> {
  const { data } = await httpClient.post<Task>(`/projects/${projectId}/tasks`, input);
  return data;
}

export async function updateTask(
  projectId: string,
  taskId: string,
  input: Partial<TaskInput>,
): Promise<Task> {
  const { data } = await httpClient.patch<Task>(`/projects/${projectId}/tasks/${taskId}`, input);
  return data;
}

export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await httpClient.delete(`/projects/${projectId}/tasks/${taskId}`);
}

/**
 * Exporta as tarefas do projeto em CSV (D-014).
 * O backend responde `text/csv` com o cabecalho
 * `titulo,descricao,status,responsavel_email,data_limite`.
 */
export async function exportTasksCsv(projectId: string): Promise<string> {
  const { data } = await httpClient.get<string>(`/projects/${projectId}/tasks/export`, {
    responseType: 'text',
  });
  return data;
}

/**
 * Importa tarefas em massa a partir de um CSV (D-014).
 * O texto do CSV e enviado no campo `file` de um multipart/form-data.
 * Linhas invalidas voltam em `errors` sem interromper a importacao.
 */
export async function importTasksCsv(projectId: string, csv: string): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', new Blob([csv], { type: 'text/csv' }), 'tarefas.csv');

  const { data } = await httpClient.post<ImportResult>(`/projects/${projectId}/tasks/import`, form);
  return data;
}
