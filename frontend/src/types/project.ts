/**
 * Tipos de projeto e membros (D-013).
 */

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export const PROJECT_ROLES: ProjectRole[] = ['owner', 'admin', 'member', 'viewer'];

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  viewer: 'Visualizador',
};

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  /** Papel do usuario logado neste projeto (D-013). */
  role: ProjectRole;
}

export interface ProjectMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
}

export interface CreateProjectDto {
  name: string;
  description?: string | null;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
}

export interface AddMemberDto {
  userId: string;
  role: ProjectRole;
}

/** Quem pode gerenciar membros (adicionar, alterar papel, remover): owner e admin. */
export function canManageMembers(actorRole: ProjectRole | undefined): boolean {
  return assignableRoles(actorRole).length > 0;
}

/**
 * Papeis que o ATOR pode atribuir (POST/PATCH de membros). O papel `owner` nasce so na criacao do
 * projeto e nunca e atribuivel: owner atribui admin, member ou viewer; admin, member ou viewer;
 * os demais papeis nao gerenciam membros.
 */
export function assignableRoles(actorRole: ProjectRole | undefined): ProjectRole[] {
  if (actorRole === 'owner') return ['admin', 'member', 'viewer'];
  if (actorRole === 'admin') return ['member', 'viewer'];
  return [];
}

/**
 * Regras do backend para alterar o papel ou remover um membro (decide a linha da tela):
 * ninguem mexe em si mesmo; o owner nunca e alterado nem removido; owner mexe em qualquer outro;
 * admin so mexe em alvos member ou viewer; member e viewer nao gerenciam. Sem o id do usuario
 * logado nao da para saber qual linha e a propria, entao nega.
 */
export function canManageMember(
  actorRole: ProjectRole | undefined,
  actorUserId: string | null,
  target: Pick<ProjectMember, 'userId' | 'role'>,
): boolean {
  if (!actorRole || !actorUserId || target.userId === actorUserId || target.role === 'owner') {
    return false;
  }

  if (actorRole === 'owner') return true;

  return actorRole === 'admin' && (target.role === 'member' || target.role === 'viewer');
}
