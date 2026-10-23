import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginatedResponse } from '../../../common/dto/paginated.dto.js';
import {
  MANAGE_ROLES,
  ProjectRole,
  READ_ROLES,
} from '../../../common/enums/project-role.enum.js';
import { toPaginatedResponse } from '../../../common/utils/pagination.util.js';
import { UsersService } from '../../users/services/users.service.js';
import { AddMemberDto } from '../dto/add-member.dto.js';
import { ListMembersQueryDto } from '../dto/list-members-query.dto.js';
import { ProjectMemberResponseDto } from '../dto/project-member-response.dto.js';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto.js';
import { ProjectMember } from '../entities/project-member.entity.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectAccessService } from './project-access.service.js';

/**
 * Papeis que um `admin` pode atribuir e sobre os quais pode agir (D-013).
 * `admin` nunca altera nem remove outro `admin` ou o `owner`.
 */
const ADMIN_MANAGEABLE_ROLES: ProjectRole[] = [ProjectRole.Member, ProjectRole.Viewer];

/**
 * Regras de membros (D-013):
 * - `owner` adiciona, altera e remove qualquer membro, exceto a si mesmo e o `owner`;
 * - `admin` so adiciona, altera e remove membros `member`/`viewer` e so atribui esses papeis;
 * - o papel `owner` nasce apenas na criacao do projeto: nao pode ser atribuido nem retirado.
 */
@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly membersRepository: ProjectMembersRepository,
    private readonly usersService: UsersService,
    private readonly accessService: ProjectAccessService,
  ) {}

  /**
   * Lista paginada dos membros do projeto, com filtro opcional por papel.
   */
  async list(
    projectId: string,
    actorId: string,
    query: ListMembersQueryDto,
  ): Promise<PaginatedResponse<ProjectMemberResponseDto>> {
    await this.accessService.requireRole(projectId, actorId, READ_ROLES);

    const [members, total] = await this.membersRepository.findPageByProject(
      projectId,
      query.role,
      query,
    );

    return toPaginatedResponse(
      members.map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.user?.name ?? '',
        email: member.user?.email ?? '',
        role: member.role,
      })),
      total,
      query,
    );
  }

  async add(projectId: string, actorId: string, dto: AddMemberDto): Promise<ProjectMemberResponseDto> {
    const actorRole = await this.accessService.requireRole(projectId, actorId, MANAGE_ROLES);

    this.assertAssignable(actorRole, dto.role);

    const user = await this.usersService.findById(dto.userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const existing = await this.membersRepository.findByProjectAndUser(projectId, dto.userId);
    if (existing) {
      throw new ConflictException('Usuário já é membro do projeto.');
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
  ): Promise<ProjectMemberResponseDto> {
    const actorRole = await this.accessService.requireRole(projectId, actorId, MANAGE_ROLES);

    if (userId === actorId) {
      throw new BadRequestException('Você não pode alterar o seu próprio papel no projeto.');
    }

    this.assertAssignable(actorRole, dto.role);

    const member = await this.findMemberOrFail(projectId, userId);
    this.assertCanManage(actorRole, member, {
      owner: 'O papel do proprietário do projeto não pode ser alterado.',
      admin: 'Administradores só podem alterar o papel de membros com papel membro ou visualizador.',
    });

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

  /**
   * Remove o membro e, na mesma transacao, desatribui as tarefas dele no projeto:
   * um ex-membro nao pode continuar como responsavel (D-013).
   */
  async remove(projectId: string, actorId: string, userId: string): Promise<void> {
    const actorRole = await this.accessService.requireRole(projectId, actorId, MANAGE_ROLES);

    if (userId === actorId) {
      throw new BadRequestException('Você não pode remover a si mesmo do projeto.');
    }

    const member = await this.findMemberOrFail(projectId, userId);
    this.assertCanManage(actorRole, member, {
      owner: 'O proprietário do projeto não pode ser removido.',
      admin: 'Administradores só podem remover membros com papel membro ou visualizador.',
    });

    await this.membersRepository.removeAndUnassignTasks(member);
  }

  private async findMemberOrFail(projectId: string, userId: string): Promise<ProjectMember> {
    const member = await this.membersRepository.findByProjectAndUser(projectId, userId);
    if (!member) {
      throw new NotFoundException('Membro não encontrado.');
    }
    return member;
  }

  /**
   * O papel `owner` nunca e atribuido por aqui; `admin` so atribui `member`/`viewer`.
   */
  private assertAssignable(actorRole: ProjectRole, role: ProjectRole): void {
    if (role === ProjectRole.Owner) {
      throw new BadRequestException(
        'O papel de proprietário é definido apenas na criação do projeto e não pode ser atribuído.',
      );
    }

    if (actorRole === ProjectRole.Admin && !ADMIN_MANAGEABLE_ROLES.includes(role)) {
      throw new ForbiddenException(
        'Administradores só podem atribuir os papéis membro ou visualizador.',
      );
    }
  }

  /**
   * O `owner` do projeto e intocavel; `admin` so age sobre `member`/`viewer`.
   */
  private assertCanManage(
    actorRole: ProjectRole,
    target: ProjectMember,
    messages: { owner: string; admin: string },
  ): void {
    if (target.role === ProjectRole.Owner) {
      throw new ForbiddenException(messages.owner);
    }

    if (actorRole === ProjectRole.Admin && !ADMIN_MANAGEABLE_ROLES.includes(target.role)) {
      throw new ForbiddenException(messages.admin);
    }
  }
}
