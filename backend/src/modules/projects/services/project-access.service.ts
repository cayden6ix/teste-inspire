import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';

/**
 * Resolve e valida o papel do usuario em um projeto (D-013).
 *
 * E a porta de entrada dos outros modulos (tarefas, relatorios) para as
 * informacoes de pertencimento: eles nao acessam os repositories deste modulo.
 */
@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly membersRepository: ProjectMembersRepository,
  ) {}

  async getRole(projectId: string, userId: string): Promise<ProjectRole | null> {
    const member = await this.membersRepository.findByProjectAndUser(projectId, userId);
    return member ? member.role : null;
  }

  /**
   * Garante que o projeto existe e que o usuario tem um dos papeis permitidos.
   */
  async requireRole(
    projectId: string,
    userId: string,
    allowed: readonly ProjectRole[],
  ): Promise<ProjectRole> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }

    const role = await this.getRole(projectId, userId);
    if (!role) {
      throw new ForbiddenException('Você não faz parte deste projeto.');
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
