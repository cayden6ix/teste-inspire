import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PaginatedResponse } from '../../../common/dto/paginated.dto.js';
import {
  MANAGE_ROLES,
  OWNER_ROLES,
  ProjectRole,
} from '../../../common/enums/project-role.enum.js';
import { SortOrder } from '../../../common/enums/sort-order.enum.js';
import { toPaginatedResponse } from '../../../common/utils/pagination.util.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';
import { ListProjectsQueryDto } from '../dto/list-projects-query.dto.js';
import { ProjectResponseDto } from '../dto/project-response.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';
import { Project } from '../entities/project.entity.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';
import { ProjectAccessService } from './project-access.service.js';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly membersRepository: ProjectMembersRepository,
    private readonly accessService: ProjectAccessService,
  ) {}

  /**
   * Cria o projeto e adiciona o autor como `owner` (D-013), na mesma transacao.
   */
  async create(userId: string, dto: CreateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.projectsRepository.createWithOwner(
      { name: dto.name, description: dto.description ?? null },
      userId,
    );

    return this.toView(project, ProjectRole.Owner);
  }

  /**
   * Lista paginada dos projetos em que o usuario e membro.
   * Ordenacao padrao: nome asc.
   */
  async listForUser(
    userId: string,
    query: ListProjectsQueryDto,
  ): Promise<PaginatedResponse<ProjectResponseDto>> {
    const [memberships, total] = await this.membersRepository.findPageByUser(
      userId,
      { search: query.search },
      {
        sortBy: query.sortBy ?? 'name',
        order: query.order ?? SortOrder.Asc,
      },
      query,
    );

    return toPaginatedResponse(
      memberships.map((membership) => this.toView(membership.project, membership.role)),
      total,
      query,
    );
  }

  async findOneForUser(projectId: string, userId: string): Promise<ProjectResponseDto> {
    const project = await this.getProjectOrFail(projectId);
    const role = await this.accessService.getRole(projectId, userId);

    if (!role) {
      throw new ForbiddenException('Você não faz parte deste projeto.');
    }

    return this.toView(project, role);
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<ProjectResponseDto> {
    const project = await this.getProjectOrFail(projectId);
    const role = await this.accessService.requireRole(projectId, userId, MANAGE_ROLES);

    if (dto.name !== undefined) {
      project.name = dto.name;
    }

    if (dto.description !== undefined) {
      project.description = dto.description;
    }

    await this.projectsRepository.save(project);

    return this.toView(project, role);
  }

  async remove(projectId: string, userId: string): Promise<void> {
    await this.getProjectOrFail(projectId);
    await this.accessService.requireRole(projectId, userId, OWNER_ROLES);
    await this.projectsRepository.delete(projectId);
  }

  private async getProjectOrFail(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Projeto não encontrado.');
    }
    return project;
  }

  private toView(project: Project, role: ProjectRole): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      role,
    };
  }
}
