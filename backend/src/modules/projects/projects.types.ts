import { SortOrder } from '../../common/enums/sort-order.enum.js';

/**
 * Tipos de dominio da listagem de projetos, compartilhados pelo DTO HTTP e pelo
 * repository (a camada de persistencia nao depende de DTOs).
 */
export type ProjectSortField = 'name' | 'createdAt' | 'updatedAt';

export const PROJECT_SORT_FIELDS: ProjectSortField[] = ['name', 'createdAt', 'updatedAt'];

export interface ProjectPageFilters {
  search?: string;
}

export interface ProjectPageSort {
  sortBy: ProjectSortField;
  order: SortOrder;
}
