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

export interface UserSearchParams extends PaginationParams {
  /** Busca parcial e case-insensitive por e-mail (ILIKE no backend). */
  email?: string;
  name?: string;
}

/**
 * Devolve envelope vazio (`data: []`) quando nao encontra ninguem.
 */
export async function findUsers(
  params: UserSearchParams = {},
): Promise<PaginatedResponse<UserSummary>> {
  const { data } = await httpClient.get<PaginatedResponse<UserSummary>>('/users', { params });
  return data;
}
