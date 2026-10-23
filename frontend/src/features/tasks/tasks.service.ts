import { httpClient } from '@/services/api/httpClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';
import { MAX_PAGE_LIMIT } from '@/types/pagination';
import type { ImportResult, Task, TaskFilters, TaskInput } from '@/types/task';

/**
 * Tarefas (D-011, D-012) e CSV (D-014).
 * Toda rota de tarefa e aninhada no projeto: a tarefa nao existe fora dele.
 */

export type TaskListParams = PaginationParams & TaskFilters;

export async function listTasks(
  projectId: string,
  params: TaskListParams = {},
): Promise<PaginatedResponse<Task>> {
  const { data } = await httpClient.get<PaginatedResponse<Task>>(`/projects/${projectId}/tasks`, {
    params,
  });
  return data;
}

/**
 * Busca todas as tarefas do projeto, pagina a pagina, no limite maximo do backend.
 * Usado pelo quadro Kanban, que mostra todas as colunas de uma vez (D-012).
 */
export async function listAllTasks(
  projectId: string,
  filters: TaskFilters = {},
  /** Chamado antes de buscar cada pagina seguinte: (proxima pagina, total de paginas). */
  onProgress?: (nextPage: number, totalPages: number) => void,
): Promise<Task[]> {
  const all: Task[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await listTasks(projectId, { ...filters, page, limit: MAX_PAGE_LIMIT });
    all.push(...response.data);
    totalPages = response.meta.totalPages;
    page += 1;

    if (page <= totalPages) {
      onProgress?.(page, totalPages);
    }
  } while (page <= totalPages);

  return all;
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

  // O Content-Type padrao do httpClient e JSON e faria o axios serializar o FormData como JSON
  // (o arquivo chegaria vazio). Com multipart explicito o navegador monta o boundary sozinho.
  const { data } = await httpClient.post<ImportResult>(`/projects/${projectId}/tasks/import`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
