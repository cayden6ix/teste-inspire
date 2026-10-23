import { Injectable } from '@nestjs/common';
import { DataSource, Repository, type DeepPartial } from 'typeorm';
import { PaginationParams } from '../../../common/dto/paginated.dto.js';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { escapeLike } from '../../../common/utils/like.util.js';
import { toSqlDirection } from '../../../common/utils/pagination.util.js';
import { Task } from '../entities/task.entity.js';
import type {
  TaskAssigneeCount,
  TaskPageFilters,
  TaskPageSort,
  TaskStatusCount,
} from '../tasks.types.js';

/**
 * Linhas por INSERT na importacao em massa. Cada tarefa usa ~8 parametros, bem
 * abaixo do limite de 65535 parametros por comando do Postgres.
 */
const INSERT_CHUNK_SIZE = 500;

@Injectable()
export class TasksRepository extends Repository<Task> {
  constructor(private dataSource: DataSource) {
    super(Task, dataSource.createEntityManager());
  }

  /**
   * Todas as tarefas do projeto (exportacao CSV) em ordem CRONOLOGICA: createdAt asc,
   * id asc (D-020). A importacao grava created_at crescente por linha, entao reimportar o
   * arquivo exportado preserva a ordem relativa (a ultima linha e a mais nova). A
   * listagem paginada continua do mais novo para o mais antigo.
   */
  findByProject(projectId: string): Promise<Task[]> {
    return this.find({
      where: { projectId },
      relations: { assignee: true },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Pagina as tarefas do projeto com filtros e ordenacao (listagem da API).
   */
  findPageByProject(
    projectId: string,
    filters: TaskPageFilters,
    sort: TaskPageSort,
    pagination: PaginationParams,
  ): Promise<[Task[], number]> {
    const query = this.createQueryBuilder('task')
      .leftJoinAndSelect('task.assignee', 'assignee')
      .where('task.projectId = :projectId', { projectId });

    if (filters.status) {
      query.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters.assigneeId) {
      query.andWhere('task.assigneeId = :assigneeId', { assigneeId: filters.assigneeId });
    }

    if (filters.search) {
      // Sem diferenciar maiusculas nem acentos (unaccent, D-029); curingas digitados sao literais.
      query.andWhere(
        '(unaccent(task.title) ILIKE unaccent(:search) OR unaccent(task.description) ILIKE unaccent(:search))',
        { search: `%${escapeLike(filters.search)}%` },
      );
    }

    if (filters.dueFrom) {
      query.andWhere('task.dueDate >= :dueFrom', { dueFrom: filters.dueFrom });
    }

    if (filters.dueTo) {
      query.andWhere('task.dueDate <= :dueTo', { dueTo: filters.dueTo });
    }

    return query
      .orderBy(`task.${sort.sortBy}`, toSqlDirection(sort.order))
      .addOrderBy('task.id', toSqlDirection(sort.order))
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .getManyAndCount();
  }

  findByProjectAndId(projectId: string, id: string): Promise<Task | null> {
    return this.findOne({ where: { id, projectId }, relations: { assignee: true } });
  }

  /**
   * Insere as tarefas em lotes, todas na mesma transacao: ou o arquivo inteiro
   * (linhas validas) entra, ou nada entra.
   */
  async insertInBatches(tasks: DeepPartial<Task>[]): Promise<number> {
    await this.manager.transaction(async (manager) => {
      for (let start = 0; start < tasks.length; start += INSERT_CHUNK_SIZE) {
        await manager.insert(Task, tasks.slice(start, start + INSERT_CHUNK_SIZE));
      }
    });

    return tasks.length;
  }

  /**
   * Quantidade de tarefas por status nos projetos informados (GROUP BY no banco).
   */
  async countByStatus(projectIds: string[]): Promise<TaskStatusCount[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const rows = await this.createQueryBuilder('task')
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('task.projectId IN (:...projectIds)', { projectIds })
      .groupBy('task.status')
      .getRawMany<{ status: TaskStatus; count: string }>();

    return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
  }

  /**
   * Quantidade de tarefas por responsavel nos projetos informados (GROUP BY no banco).
   * Tarefas sem responsavel formam um grupo com `assigneeId` nulo.
   */
  async countByAssignee(projectIds: string[]): Promise<TaskAssigneeCount[]> {
    if (projectIds.length === 0) {
      return [];
    }

    const rows = await this.createQueryBuilder('task')
      .leftJoin('task.assignee', 'assignee')
      .select('task.assigneeId', 'assigneeId')
      .addSelect('assignee.name', 'assigneeName')
      .addSelect('COUNT(*)', 'count')
      .where('task.projectId IN (:...projectIds)', { projectIds })
      .groupBy('task.assigneeId')
      .addGroupBy('assignee.name')
      .getRawMany<{ assigneeId: string | null; assigneeName: string | null; count: string }>();

    return rows.map((row) => ({
      assigneeId: row.assigneeId,
      assigneeName: row.assigneeName,
      count: Number(row.count),
    }));
  }
}
