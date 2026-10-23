import { httpClient } from '@/services/api/httpClient';
import type { PaginatedResponse, PaginationParams } from '@/types/pagination';

/**
 * Usuario publico devolvido pela busca de membros (D-013).
 * O backend nao expoe senha: `GET /users?email=` devolve id, nome e e-mail.
 */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

/** Maximo de usuarios por pagina na busca (a API recusa mais que isso, D-028). */
export const USER_SEARCH_LIMIT = 10;

export interface UserSearchParams extends PaginationParams {
  /** Busca parcial por e-mail, sem diferenciar maiusculas nem acentos. */
  email?: string;
  name?: string;
}

/**
 * Devolve envelope vazio (`data: []`) quando nao encontra ninguem. So quem e owner ou admin de
 * algum projeto pode buscar (403 para os demais).
 */
export async function findUsers(
  params: UserSearchParams = {},
): Promise<PaginatedResponse<UserSummary>> {
  const { data } = await httpClient.get<PaginatedResponse<UserSummary>>('/users', { params });
  return data;
}
