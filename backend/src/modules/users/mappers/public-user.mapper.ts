import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import type { User } from '../entities/user.entity.js';

/**
 * Dados publicos do usuario: tudo menos o hash da senha.
 * Usado na resposta de login/cadastro e no usuario autenticado da requisicao.
 */
export function toPublicUser(user: User): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
