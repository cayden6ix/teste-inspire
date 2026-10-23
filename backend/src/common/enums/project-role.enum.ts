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

/** Leitura do projeto, das tarefas, dos membros e dos relatorios: qualquer membro. */
export const READ_ROLES: readonly ProjectRole[] = PROJECT_ROLE_VALUES;

/** Criar, editar e excluir tarefas (inclusive importar CSV). */
export const WRITE_ROLES: readonly ProjectRole[] = [
  ProjectRole.Owner,
  ProjectRole.Admin,
  ProjectRole.Member,
];

/** Editar o projeto e gerenciar membros. */
export const MANAGE_ROLES: readonly ProjectRole[] = [ProjectRole.Owner, ProjectRole.Admin];

/** Excluir o projeto. */
export const OWNER_ROLES: readonly ProjectRole[] = [ProjectRole.Owner];

/**
 * Nome do papel como aparece para o usuario (mesmos termos da interface).
 * Os valores do enum continuam em ingles na API e no banco.
 */
export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  [ProjectRole.Owner]: 'proprietário',
  [ProjectRole.Admin]: 'administrador',
  [ProjectRole.Member]: 'membro',
  [ProjectRole.Viewer]: 'visualizador',
};
