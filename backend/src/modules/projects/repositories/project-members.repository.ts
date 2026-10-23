import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { PaginationParams } from '../../../common/dto/paginated.dto.js';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { escapeLike } from '../../../common/utils/like.util.js';
import { toSqlDirection } from '../../../common/utils/pagination.util.js';
import { Task } from '../../tasks/entities/task.entity.js';
import { ProjectMember } from '../entities/project-member.entity.js';
import type { ProjectPageFilters, ProjectPageSort } from '../projects.types.js';

/** Id e e-mail (em minusculas) de um membro do projeto. */
export interface MemberEmail {
  userId: string;
  email: string;
}

@Injectable()
export class ProjectMembersRepository extends Repository<ProjectMember> {
  constructor(private dataSource: DataSource) {
    super(ProjectMember, dataSource.createEntityManager());
  }

  /**
   * Pagina os membros de um projeto, com filtro opcional por papel.
   * Ordenacao: nome do usuario asc.
   */
  findPageByProject(
    projectId: string,
    role: ProjectRole | undefined,
    pagination: PaginationParams,
  ): Promise<[ProjectMember[], number]> {
    return this.findAndCount({
      where: role ? { projectId, role } : { projectId },
      relations: { user: true },
      order: { user: { name: 'ASC' }, id: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
  }

  /**
   * Pagina os projetos em que o usuario e membro, trazendo o papel dele.
   * Busca parcial em nome e descricao do projeto.
   */
  findPageByUser(
    userId: string,
    filters: ProjectPageFilters,
    sort: ProjectPageSort,
    pagination: PaginationParams,
  ): Promise<[ProjectMember[], number]> {
    const query = this.createQueryBuilder('member')
      .innerJoinAndSelect('member.project', 'project')
      .where('member.userId = :userId', { userId });

    if (filters.search) {
      // Sem diferenciar maiusculas nem acentos (unaccent, D-029); curingas digitados sao literais.
      query.andWhere(
        '(unaccent(project.name) ILIKE unaccent(:search) OR unaccent(project.description) ILIKE unaccent(:search))',
        { search: `%${escapeLike(filters.search)}%` },
      );
    }

    return query
      .orderBy(`project.${sort.sortBy}`, toSqlDirection(sort.order))
      .addOrderBy('project.id', toSqlDirection(sort.order))
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();
  }

  findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.findOne({ where: { projectId, userId } });
  }

  /** O usuario tem algum vinculo com um dos papeis informados (em qualquer projeto)? */
  existsByUserWithRoles(userId: string, roles: readonly ProjectRole[]): Promise<boolean> {
    return this.exists({ where: { userId, role: In([...roles]) } });
  }

  /** Ids dos projetos em que o usuario e membro (qualquer papel). */
  async findProjectIdsByUser(userId: string): Promise<string[]> {
    const rows = await this.find({ where: { userId }, select: { projectId: true } });
    return rows.map((row) => row.projectId);
  }

  /**
   * Id e e-mail de todos os membros do projeto em uma unica query
   * (a importacao CSV resolve os responsaveis sem N+1).
   */
  findMemberEmails(projectId: string): Promise<MemberEmail[]> {
    return this.createQueryBuilder('member')
      .innerJoin('member.user', 'user')
      .select('member.userId', 'userId')
      .addSelect('LOWER(user.email)', 'email')
      .where('member.projectId = :projectId', { projectId })
      .getRawMany<MemberEmail>();
  }

  /**
   * Remove o membro e desatribui as tarefas dele no projeto, na mesma transacao:
   * nenhuma tarefa fica com um responsavel que nao e mais membro.
   */
  async removeAndUnassignTasks(member: ProjectMember): Promise<void> {
    await this.manager.transaction(async (manager) => {
      await manager.update(
        Task,
        { projectId: member.projectId, assigneeId: member.userId },
        { assigneeId: null },
      );
      await manager.delete(ProjectMember, { id: member.id });
    });
  }
}
