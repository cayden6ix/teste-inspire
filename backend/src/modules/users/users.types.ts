import { SortOrder } from '../../common/enums/sort-order.enum.js';

/**
 * Tipos de dominio da busca de usuarios, compartilhados pelo DTO HTTP e pelo
 * repository (a camada de persistencia nao depende de DTOs).
 */
export type UserSortField = 'name' | 'email';

export const USER_SORT_FIELDS: UserSortField[] = ['name', 'email'];

export interface UserPageFilters {
  name?: string;
  email?: string;
}

export interface UserPageSort {
  sortBy: UserSortField;
  order: SortOrder;
}
