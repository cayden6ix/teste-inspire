import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CSV_IMPORT_MAX_ROWS } from '../../../common/constants/upload.constants.js';
import { PaginatedResponse } from '../../../common/dto/paginated.dto.js';
import { READ_ROLES, WRITE_ROLES } from '../../../common/enums/project-role.enum.js';
import { SortOrder } from '../../../common/enums/sort-order.enum.js';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';
import { isValidDateOnly } from '../../../common/utils/date.util.js';
import { toPaginatedResponse } from '../../../common/utils/pagination.util.js';
import { ProjectAccessService } from '../../projects/services/project-access.service.js';
import { User } from '../../users/entities/user.entity.js';
import { UsersService } from '../../users/services/users.service.js';
import { CreateTaskDto } from '../dto/create-task.dto.js';
import { ImportErrorDto, ImportResultDto } from '../dto/import-result.dto.js';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto.js';
import { TaskResponseDto } from '../dto/task-response.dto.js';
import { UpdateTaskDto } from '../dto/update-task.dto.js';
import { Task } from '../entities/task.entity.js';
import { TasksRepository } from '../repositories/tasks.repository.js';
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  type TaskAssigneeCount,
  type TaskStatusCount,
} from '../tasks.types.js';
import { normalizeCsvKey, TasksCsvService } from './tasks-csv.service.js';

/** Lista dos status aceitos, para a mensagem de erro da importacao. */
const VALID_STATUS_HINT = `Use: ${TASK_STATUS_VALUES.slice(0, -1).join(', ')} ou ${TASK_STATUS_VALUES.at(-1)}.`;

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly accessService: ProjectAccessService,
    private readonly usersService: UsersService,
    private readonly csvService: TasksCsvService,
  ) {}

  /**
   * Lista paginada das tarefas do projeto. Ordenacao padrao: mais recentes primeiro.
   */
  async list(
    projectId: string,
    actorId: string,
    query: ListTasksQueryDto,
  ): Promise<PaginatedResponse<TaskResponseDto>> {
    await this.accessService.requireRole(projectId, actorId, READ_ROLES);

    if (query.dueFrom && query.dueTo && query.dueFrom > query.dueTo) {
      throw new BadRequestException('A data limite inicial não pode ser posterior à data limite final.');
    }

    const [tasks, total] = await this.tasksRepository.findPageByProject(
      projectId,
      {
        status: query.status,
        assigneeId: query.assigneeId,
        search: query.search,
        dueFrom: query.dueFrom,
        dueTo: query.dueTo,
      },
      {
        sortBy: query.sortBy ?? 'createdAt',
        order: query.order ?? SortOrder.Desc,
      },
      query,
    );

    return toPaginatedResponse(
      tasks.map((task) => this.toView(task)),
      total,
      query,
    );
  }

  async findOne(projectId: string, taskId: string, actorId: string): Promise<TaskResponseDto> {
    await this.accessService.requireRole(projectId, actorId, READ_ROLES);
    const task = await this.tasksRepository.findByProjectAndId(projectId, taskId);

    if (!task) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    return this.toView(task);
  }

  async create(projectId: string, actorId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    await this.accessService.requireRole(projectId, actorId, WRITE_ROLES);

    const assigneeId = await this.resolveAssignee(projectId, dto.assigneeId);
    const task = await this.tasksRepository.save(
      this.tasksRepository.create({
        projectId,
        title: dto.title,
        description: dto.description ?? null,
        status: dto.status ?? TaskStatus.Pendente,
        assigneeId,
        dueDate: dto.dueDate ?? null,
      }),
    );

    const saved = await this.tasksRepository.findByProjectAndId(projectId, task.id);
    return this.toView(saved ?? task);
  }

  async update(
    projectId: string,
    taskId: string,
    actorId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    await this.accessService.requireRole(projectId, actorId, WRITE_ROLES);

    const task = await this.tasksRepository.findByProjectAndId(projectId, taskId);
    if (!task) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    if (dto.title !== undefined) {
      task.title = dto.title;
    }

    if (dto.description !== undefined) {
      task.description = dto.description;
    }

    if (dto.status !== undefined) {
      task.status = dto.status;
    }

    if (dto.assigneeId !== undefined) {
      const assigneeId = await this.resolveAssignee(projectId, dto.assigneeId);
      // A relacao `assignee` veio carregada: no save, o TypeORM grava a FK a partir dela
      // e ignoraria so a coluna. Coluna e relacao precisam mudar juntas.
      task.assigneeId = assigneeId;
      task.assignee = assigneeId ? ({ id: assigneeId } as User) : null;
    }

    if (dto.dueDate !== undefined) {
      task.dueDate = dto.dueDate;
    }

    await this.tasksRepository.save(task);

    const saved = await this.tasksRepository.findByProjectAndId(projectId, task.id);
    return this.toView(saved ?? task);
  }

  async remove(projectId: string, taskId: string, actorId: string): Promise<void> {
    await this.accessService.requireRole(projectId, actorId, WRITE_ROLES);

    const task = await this.tasksRepository.findByProjectAndId(projectId, taskId);
    if (!task) {
      throw new NotFoundException('Tarefa não encontrada.');
    }

    await this.tasksRepository.delete(task.id);
  }

  /**
   * Exporta as tarefas do projeto em CSV (D-014).
   */
  async exportCsv(projectId: string, actorId: string): Promise<string> {
    await this.accessService.requireRole(projectId, actorId, READ_ROLES);
    const tasks = await this.tasksRepository.findByProject(projectId);
    return this.csvService.toCsv(tasks);
  }

  /**
   * Importa tarefas em massa a partir de um CSV (D-014).
   *
   * Linhas invalidas sao devolvidas em `errors` e nao interrompem a importacao.
   * Os responsaveis sao resolvidos com os membros do projeto pre-carregados (uma
   * query) e as linhas validas sao inseridas em lotes, numa unica transacao.
   */
  async importCsv(projectId: string, actorId: string, csvText: string): Promise<ImportResultDto> {
    await this.accessService.requireRole(projectId, actorId, WRITE_ROLES);

    const rows = this.csvService.parse(csvText);
    if (rows.length > CSV_IMPORT_MAX_ROWS) {
      throw new BadRequestException(
        `O arquivo excede o limite de ${CSV_IMPORT_MAX_ROWS} linhas por importação.`,
      );
    }

    const memberIdsByEmail = await this.accessService.getMemberIdsByEmail(projectId);
    const registeredEmails = await this.findRegisteredEmails(rows, memberIdsByEmail);

    const errors: ImportErrorDto[] = [];
    const tasks: Partial<Task>[] = [];
    // created_at explicito e crescente por linha: a ultima linha do arquivo fica como a mais nova
    // (ordem padrao createdAt desc), mesmo quando as linhas sao gravadas no mesmo instante.
    const importedAt = Date.now();

    for (const [index, row] of rows.entries()) {
      const lineNumber = index + 2; // a linha 1 do CSV e o cabecalho
      const title = (row['titulo'] ?? '').trim();

      if (!title) {
        errors.push({ row: lineNumber, message: 'O título é obrigatório.' });
        continue;
      }

      if (title.length > TASK_TITLE_MAX_LENGTH) {
        errors.push({
          row: lineNumber,
          message: `O título deve ter no máximo ${TASK_TITLE_MAX_LENGTH} caracteres.`,
        });
        continue;
      }

      const description = (row['descricao'] ?? '').trim() || null;
      if (description && description.length > TASK_DESCRIPTION_MAX_LENGTH) {
        errors.push({
          row: lineNumber,
          message: `A descrição deve ter no máximo ${TASK_DESCRIPTION_MAX_LENGTH} caracteres.`,
        });
        continue;
      }

      // Aceita variacoes de escrita: 'Em Andamento', ' PENDENTE ', 'Concluída' (D-030).
      const statusRaw = (row['status'] ?? '').trim();
      const status = (normalizeCsvKey(statusRaw) || TaskStatus.Pendente) as TaskStatus;

      if (!TASK_STATUS_VALUES.includes(status)) {
        errors.push({ row: lineNumber, message: `Status inválido: "${statusRaw}". ${VALID_STATUS_HINT}` });
        continue;
      }

      const email = normalizeEmail(row['responsavel_email']);
      let assigneeId: string | null = null;

      if (email) {
        const memberId = memberIdsByEmail.get(email);

        if (!memberId) {
          errors.push({
            row: lineNumber,
            message: registeredEmails.has(email)
              ? `Responsável não é membro do projeto: ${email}.`
              : `Usuário não encontrado: ${email}.`,
          });
          continue;
        }

        assigneeId = memberId;
      }

      const dueDate = (row['data_limite'] ?? '').trim();
      if (dueDate && !isValidDateOnly(dueDate)) {
        errors.push({ row: lineNumber, message: `Data limite inválida: ${dueDate}. Use o formato AAAA-MM-DD.` });
        continue;
      }

      tasks.push({
        projectId,
        title,
        description,
        status,
        assigneeId,
        dueDate: dueDate || null,
        createdAt: new Date(importedAt + index),
      });
    }

    const created = tasks.length > 0 ? await this.tasksRepository.insertInBatches(tasks) : 0;

    return { created, errors };
  }

  /** Contagem por status nos projetos informados (relatorios, D-015). */
  countByStatus(projectIds: string[]): Promise<TaskStatusCount[]> {
    return this.tasksRepository.countByStatus(projectIds);
  }

  /** Contagem por responsavel nos projetos informados (relatorios, D-015). */
  countByAssignee(projectIds: string[]): Promise<TaskAssigneeCount[]> {
    return this.tasksRepository.countByAssignee(projectIds);
  }

  /**
   * Dos e-mails do CSV que nao sao de membros, quais estao cadastrados: so serve
   * para diferenciar "não é membro" de "usuário não encontrado" (uma query).
   */
  private async findRegisteredEmails(
    rows: Record<string, string>[],
    memberIdsByEmail: Map<string, string>,
  ): Promise<Set<string>> {
    const unknown = new Set<string>();

    for (const row of rows) {
      const email = normalizeEmail(row['responsavel_email']);
      if (email && !memberIdsByEmail.has(email)) {
        unknown.add(email);
      }
    }

    return this.usersService.findRegisteredEmails([...unknown]);
  }

  /**
   * O responsavel precisa ser membro do projeto.
   */
  private async resolveAssignee(
    projectId: string,
    assigneeId: string | null | undefined,
  ): Promise<string | null> {
    if (!assigneeId) {
      return null;
    }

    if (!(await this.accessService.isMember(projectId, assigneeId))) {
      throw new BadRequestException('O responsável precisa ser membro do projeto.');
    }

    return assigneeId;
  }

  private toView(task: Task): TaskResponseDto {
    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      description: task.description,
      status: task.status,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.name ?? null,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

function normalizeEmail(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}
