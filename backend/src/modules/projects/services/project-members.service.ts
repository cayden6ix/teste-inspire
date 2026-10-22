import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { UsersService } from '../../users/services/users.service.js';
import { AddMemberDto } from '../dto/add-member.dto.js';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectAccessService } from './project-access.service.js';

export interface ProjectMemberView {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
}

/**
 * Papeis que um `admin` pode atribuir. `owner` e `admin` sao exclusivos do
 * proprio `owner` do projeto (D-013).
 */
const ADMIN_ASSIGNABLE_ROLES: ProjectRole[] = [ProjectRole.Member, ProjectRole.Viewer];

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly membersRepository: ProjectMembersRepository,
    private readonly usersService: UsersService,
    private readonly accessService: ProjectAccessService,
  ) {}

  async list(projectId: string, actorId: string): Promise<ProjectMemberView[]> {
    await this.accessService.requireRole(projectId, actorId, [
      ProjectRole.Owner,
      ProjectRole.Admin,
      ProjectRole.Member,
      ProjectRole.Viewer,
    ]);

    const members = await this.membersRepository.findByProject(projectId);

    return members.map((member) => ({
      id: member.id,
      userId: member.userId,
      name: member.user?.name ?? '',
      email: member.user?.email ?? '',
      role: member.role,
    }));
  }

  async add(projectId: string, actorId: string, dto: AddMemberDto): Promise<ProjectMemberView> {
    const actorRole = await this.accessService.requireRole(projectId, actorId, [
      ProjectRole.Owner,
      ProjectRole.Admin,
    ]);

    if (actorRole === ProjectRole.Admin && !ADMIN_ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new ForbiddenException('Admin so pode adicionar membros com papel member ou viewer');
    }

    const user = await this.usersService.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    const existing = await this.membersRepository.findByProjectAndUser(projectId, dto.userId);
    if (existing) {
      throw new ConflictException('Usuario ja e membro do projeto');
    }

    const member = await this.membersRepository.save(
      this.membersRepository.create({
        projectId,
        userId: dto.userId,
        role: dto.role,
      }),
    );

    return {
      id: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
    };
  }

  async updateRole(
    projectId: string,
    actorId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<ProjectMemberView> {
    const actorRole = await this.accessService.requireRole(projectId, actorId, [
      ProjectRole.Owner,
      ProjectRole.Admin,
    ]);

    if (actorRole === ProjectRole.Admin && !ADMIN_ASSIGNABLE_ROLES.includes(dto.role)) {
      throw new ForbiddenException('Admin so pode atribuir os papeis member ou viewer');
    }

    const member = await this.membersRepository.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new NotFoundException('Membro nao encontrado');
    }

    if (member.role === ProjectRole.Owner && actorRole !== ProjectRole.Owner) {
      throw new ForbiddenException('Somente o owner altera o papel do owner');
    }

    member.role = dto.role;
    await this.membersRepository.save(member);

    const user = await this.usersService.findById(member.userId);

    return {
      id: member.id,
      userId: member.userId,
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: member.role,
    };
  }

  async remove(projectId: string, actorId: string, userId: string): Promise<void> {
    await this.accessService.requireRole(projectId, actorId, [ProjectRole.Owner, ProjectRole.Admin]);

    const member = await this.membersRepository.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new NotFoundException('Membro nao encontrado');
    }

    if (member.role === ProjectRole.Owner) {
      throw new BadRequestException('O owner do projeto nao pode ser removido');
    }

    if (member.userId === actorId) {
      throw new BadRequestException('Voce nao pode remover a si mesmo do projeto');
    }

    await this.membersRepository.delete(member.id);
  }
}
