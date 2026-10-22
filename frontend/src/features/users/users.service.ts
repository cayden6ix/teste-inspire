import { httpClient } from '@/services/api/httpClient';

/**
 * Usuario publico devolvido pela busca de membros (D-013).
 * O backend nao expoe senha: `GET /users?email=` devolve id, nome e e-mail.
 */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

/**
 * Busca parcial e case-insensitive por e-mail (ILIKE no backend).
 * Devolve lista vazia quando nao encontra ninguem.
 */
export async function findUsers(email: string): Promise<UserSummary[]> {
  const { data } = await httpClient.get<UserSummary[]>('/users', { params: { email } });
  return data;
}
