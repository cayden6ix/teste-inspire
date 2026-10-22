import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';

/**
 * Qualquer membro do projeto, inclusive `viewer` (D-013).
 */
export const ANY_PROJECT_ROLE: ProjectRole[] = [
  ProjectRole.Owner,
  ProjectRole.Admin,
  ProjectRole.Member,
  ProjectRole.Viewer,
];

/**
 * Resolve e valida o papel do usuario em um projeto (D-013).
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
    allowed: ProjectRole[],
  ): Promise<ProjectRole> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }

    const role = await this.getRole(projectId, userId);
    if (!role) {
      throw new ForbiddenException('Voce nao faz parte deste projeto');
    }

    if (!allowed.includes(role)) {
      throw new ForbiddenException('Seu papel no projeto nao permite esta acao');
    }

    return role;
  }
}
