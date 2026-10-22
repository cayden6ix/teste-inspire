import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';
import { Project } from '../entities/project.entity.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';
import { ProjectAccessService } from './project-access.service.js';

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: ProjectRole;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly membersRepository: ProjectMembersRepository,
    private readonly accessService: ProjectAccessService,
  ) {}

  /**
   * Cria o projeto e adiciona o autor como `owner` (D-013).
   */
  async create(userId: string, dto: CreateProjectDto): Promise<ProjectView> {
    const project = await this.projectsRepository.save(
      this.projectsRepository.create({
        name: dto.name,
        description: dto.description ?? null,
      }),
    );

    await this.membersRepository.save(
      this.membersRepository.create({
        projectId: project.id,
        userId,
        role: ProjectRole.Owner,
      }),
    );

    return this.toView(project, ProjectRole.Owner);
  }

  async listForUser(userId: string): Promise<ProjectView[]> {
    const memberships = await this.membersRepository.findByUser(userId);
    if (memberships.length === 0) {
      return [];
    }

    const roleByProject = new Map(memberships.map((m) => [m.projectId, m.role]));
    const projects = await this.projectsRepository.find({
      where: { id: In(memberships.map((m) => m.projectId)) },
    });

    return projects
      .map((project) => this.toView(project, roleByProject.get(project.id) ?? ProjectRole.Viewer))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findOneForUser(projectId: string, userId: string): Promise<ProjectView> {
    const project = await this.getProjectOrFail(projectId);
    const role = await this.accessService.getRole(projectId, userId);

    if (!role) {
      throw new ForbiddenException('Voce nao faz parte deste projeto');
    }

    return this.toView(project, role);
  }

  async update(projectId: string, userId: string, dto: UpdateProjectDto): Promise<ProjectView> {
    const project = await this.getProjectOrFail(projectId);
    await this.accessService.requireRole(projectId, userId, [ProjectRole.Owner, ProjectRole.Admin]);

    if (dto.name !== undefined) {
      project.name = dto.name;
    }

    if (dto.description !== undefined) {
      project.description = dto.description;
    }

    await this.projectsRepository.save(project);
    const role = await this.accessService.getRole(projectId, userId);

    return this.toView(project, role ?? ProjectRole.Viewer);
  }

  async remove(projectId: string, userId: string): Promise<void> {
    await this.getProjectOrFail(projectId);
    await this.accessService.requireRole(projectId, userId, [ProjectRole.Owner]);
    await this.projectsRepository.delete(projectId);
  }

  private async getProjectOrFail(projectId: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException('Projeto nao encontrado');
    }
    return project;
  }

  private toView(project: Project, role: ProjectRole): ProjectView {
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
