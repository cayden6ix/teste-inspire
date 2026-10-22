/**
 * Tipos de projeto e membros (D-013).
 */

export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

export const PROJECT_ROLES: ProjectRole[] = ['owner', 'admin', 'member', 'viewer'];

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Membro',
  viewer: 'Viewer',
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

/**
 * O backend so deixa admin atribuir `member` ou `viewer`; `owner` e `admin`
 * sao exclusivos do owner do projeto.
 */
export function assignableRoles(currentRole: ProjectRole): ProjectRole[] {
  return currentRole === 'owner' ? PROJECT_ROLES : PROJECT_ROLES.filter((r) => r === 'member' || r === 'viewer');
}
