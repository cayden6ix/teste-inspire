import axios from 'axios';
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
 * Teto de paginas que o quadro carrega: 50 paginas de 100 = 5.000 tarefas (KAN-15). Abrir o
 * quadro nunca gasta mais que metade do rate limit geral (100 requisicoes por minuto).
 */
export const BOARD_MAX_PAGES = 50;

export const BOARD_MAX_TASKS = BOARD_MAX_PAGES * MAX_PAGE_LIMIT;

export interface AllTasksResult {
  /** As tarefas carregadas, das mais recentes para as mais antigas. */
  tasks: Task[];
  /** Total de tarefas que o filtro encontra no servidor (pode passar do que foi carregado). */
  total: number;
  /** Havia mais tarefas do que o teto: so as `BOARD_MAX_TASKS` mais recentes vieram. */
  truncated: boolean;
}

/**
 * Busca as tarefas do projeto pagina a pagina, no limite maximo do backend, ate `maxPages`.
 * Usado pelo quadro Kanban, que mostra todas as colunas de uma vez (D-012).
 */
export async function listAllTasks(
  projectId: string,
  filters: TaskFilters = {},
  /** Chamado antes de buscar cada pagina seguinte: (proxima pagina, ultima pagina que sera lida). */
  onProgress?: (nextPage: number, totalPages: number) => void,
  maxPages = BOARD_MAX_PAGES,
): Promise<AllTasksResult> {
  const tasks: Task[] = [];
  let page = 1;
  let lastPage = 1;
  let total = 0;
  let totalPages = 0;

  do {
    const response = await listTasks(projectId, { ...filters, page, limit: MAX_PAGE_LIMIT });
    tasks.push(...response.data);
    total = response.meta.total;
    totalPages = response.meta.totalPages;
    lastPage = Math.min(totalPages, maxPages);
    page += 1;

    if (page <= lastPage) {
      onProgress?.(page, lastPage);
    }
  } while (page <= lastPage);

  return { tasks, total, truncated: totalPages > maxPages };
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
 * Exporta as tarefas do projeto em CSV (D-014), em ordem cronologica (D-020).
 * O backend responde `text/csv` em UTF-8 COM BOM (D-030), com o cabecalho
 * `titulo,descricao,status,responsavel_email,data_limite`. Vem como Blob (bytes intactos):
 * lido como texto, o navegador descartaria o BOM e o Excel mostraria os acentos errados.
 */
export async function exportTasksCsv(projectId: string): Promise<Blob> {
  try {
    const { data } = await httpClient.get<Blob>(`/projects/${projectId}/tasks/export`, {
      responseType: 'blob',
    });
    return data;
  } catch (error) {
    // Com responseType 'blob' o corpo do erro tambem chega como Blob: volta a ser o JSON da API,
    // para a mensagem em portugues (ex.: 404 'Projeto não encontrado.') chegar ao toast.
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text()) as unknown;
      } catch {
        // Corpo que nao e JSON: fica a mensagem generica do status.
      }
    }
    throw error;
  }
}

/**
 * Importa tarefas em massa a partir de um CSV (D-014).
 * O proprio arquivo escolhido vai no campo `file` de um multipart/form-data, sem ser relido
 * como texto: o backend recebe os bytes originais (com ou sem BOM) e detecta arquivo que nao
 * e CSV. Linhas invalidas voltam em `errors` sem interromper a importacao.
 */
export async function importTasksCsv(projectId: string, file: Blob): Promise<ImportResult> {
  const form = new FormData();
  form.append('file', file, 'tarefas.csv');

  // O Content-Type padrao do httpClient e JSON e faria o axios serializar o FormData como JSON
  // (o arquivo chegaria vazio). Com multipart explicito o navegador monta o boundary sozinho.
  const { data } = await httpClient.post<ImportResult>(`/projects/${projectId}/tasks/import`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
