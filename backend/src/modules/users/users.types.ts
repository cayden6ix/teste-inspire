import { SortOrder } from '../../common/enums/sort-order.enum.js';

/**
 * Tipos de dominio da busca de usuarios, compartilhados pelo DTO HTTP e pelo
 * repository (a camada de persistencia nao depende de DTOs).
 */
export type UserSortField = 'name' | 'email';

export const USER_SORT_FIELDS: UserSortField[] = ['name', 'email'];

/** Maximo (e padrao) de itens por pagina na busca de usuarios: menor que o das listagens. */
export const USER_SEARCH_MAX_LIMIT = 10;

export interface UserPageFilters {
  name?: string;
  email?: string;
}

export interface UserPageSort {
  sortBy: UserSortField;
  order: SortOrder;
}

/**
 * Limites dos dados da conta (cadastro e login), aplicados nos DTOs.
 * - e-mail: 254 caracteres, o maximo de um endereco valido (RFC 5321);
 * - senha: 6 a 72. O bcrypt considera so os primeiros 72 bytes e ignora o resto em
 *   silencio; o teto tambem impede que um texto enorme vire custo de hash (login e cadastro).
 */
export const USER_NAME_MAX_LENGTH = 120;

export const USER_EMAIL_MAX_LENGTH = 254;

export const USER_PASSWORD_MIN_LENGTH = 6;

export const USER_PASSWORD_MAX_LENGTH = 72;
