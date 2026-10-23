/**
 * Contrato de paginacao das listagens (projetos, tarefas, membros e usuarios).
 *
 * `limit` vai de 1 a 100 e o padrao do backend e 15.
 */

export const DEFAULT_PAGE_LIMIT = 15;

export const MAX_PAGE_LIMIT = 100;

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  /** Zero quando `total` e zero. */
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
