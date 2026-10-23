import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MANAGE_ROLES, ProjectRole } from '../../../common/enums/project-role.enum.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';

/**
 * Resposta de projeto inexistente E de projeto do qual o usuario nao e membro: as duas
 * situacoes sao indistinguiveis por fora, entao um id valido de projeto alheio nao vaza.
 */
export const PROJECT_NOT_FOUND_MESSAGE = 'Projeto não encontrado.';

/**
 * Resolve e valida o papel do usuario em um projeto (D-013, D-024).
 *
 * E a porta de entrada dos outros modulos (tarefas, relatorios) para as
 * informacoes de pertencimento: eles nao acessam os repositories deste modulo.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly membersRepository: ProjectMembersRepository) {}

  async getRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await this.membersRepository.findByProjectAndUser(projectId, userId);
    return member ? member.role : null;
  }

  /**
   * Garante que o usuario e membro do projeto e tem um dos papeis permitidos.
   *
   * - nao e membro (ou o projeto nao existe): 404 `Projeto não encontrado.` (D-027);
   * - e membro, mas o papel nao basta: 403 `Seu papel no projeto não permite esta ação.`.
   *
   * O vinculo so existe se o projeto existe (FK com cascade), entao uma unica consulta
   * responde as duas perguntas.
   */
  async requireRole(
    projectId: string,
    userId: string,
    allowed: readonly ProjectRole[],
  ): Promise<ProjectRole> {
    const role = await this.getRole(projectId, userId);
    if (!role) {
      throw new NotFoundException(PROJECT_NOT_FOUND_MESSAGE);
    }

    if (!allowed.includes(role)) {
      throw new ForbiddenException('Seu papel no projeto não permite esta ação.');
    }

    return role;
  }

  /** O usuario e membro do projeto (qualquer papel)? */
  async isMember(projectId: string, userId: string): Promise<boolean> {
    return (await this.getRole(projectId, userId)) !== null;
  }

  /**
   * O usuario e `owner` ou `admin` de pelo menos um projeto, ou seja, pode adicionar
   * membros em algum lugar (condicao para usar a busca de usuarios, D-028).
   */
  managesAnyProject(userId: string): Promise<boolean> {
    return this.membersRepository.existsByUserWithRoles(userId, MANAGE_ROLES);
  }

  /** Ids dos projetos em que o usuario e membro. */
  listProjectIdsOfUser(userId: string): Promise<string[]> {
    return this.membersRepository.findProjectIdsByUser(userId);
  }

  /**
   * Mapa e-mail (minusculas) -> id dos membros do projeto, montado com uma unica query.
   */
  async getMemberIdsByEmail(projectId: string): Promise<Map<string, string>> {
    const members = await this.membersRepository.findMemberEmails(projectId);
    return new Map(members.map((member) => [member.email, member.userId]));
  }
}
