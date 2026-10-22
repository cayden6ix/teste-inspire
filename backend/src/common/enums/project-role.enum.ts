/**
 * Papeis de um membro dentro de um projeto (D-013).
 *
 * Ordem de permissao: `owner` > `admin` > `member` > `viewer`.
 */
export enum ProjectRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member',
  Viewer = 'viewer',
}

export const PROJECT_ROLE_VALUES: ProjectRole[] = [
  ProjectRole.Owner,
  ProjectRole.Admin,
  ProjectRole.Member,
  ProjectRole.Viewer,
];
