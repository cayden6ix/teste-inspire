import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';
import { ProjectMembersRepository } from '../../projects/repositories/project-members.repository.js';
import { ProjectAccessService } from '../../projects/services/project-access.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { CreateTaskDto } from '../dto/create-task.dto.js';
import { UpdateTaskDto } from '../dto/update-task.dto.js';
import { Task } from '../entities/task.entity.js';
import { TaskFilters, TasksRepository } from '../repositories/tasks.repository.js';
import { TasksCsvService } from './tasks-csv.service.js';

export interface TaskView {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportResult {
  created: number;
  errors: ImportError[];
}

const READ_ROLES = [
  ProjectRole.Owner,
  ProjectRole.Admin,
  ProjectRole.Member,
  ProjectRole.Viewer,
];

const WRITE_ROLES = [ProjectRole.Owner, ProjectRole.Admin, ProjectRole.Member];

@Injectable()
export class TasksService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly membersRepository: ProjectMembersRepository,
    private readonly accessService: ProjectAccessService,
    private readonly usersService: UsersService,
    private readonly csvService: TasksCsvService,
  ) {}

  async list(projectId: string, actorId: string, filters: TaskFilters): Promise<TaskView[]> {
    await this.accessService.requireRole(projectId, actorId, READ_ROLES);
    const tasks = await this.tasksRepository.findByProject(projectId, filters);
    return tasks.map((task) => this.toView(task));
  }

  async findOne(projectId: string, taskId: string, actorId: string): Promise<TaskView> {
    await this.accessService.requireRole(projectId, actorId, READ_ROLES);
    const task = await this.tasksRepository.findByProjectAndId(projectId, taskId);

    if (!task) {
      throw new NotFoundException('Tarefa nao encontrada');
    }

    return this.toView(task);
  }

  async create(projectId: string, actorId: string, dto: CreateTaskDto): Promise<TaskView> {
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
  ): Promise<TaskView> {
    await this.accessService.requireRole(projectId, actorId, WRITE_ROLES);

    const task = await this.tasksRepository.findByProjectAndId(projectId, taskId);
    if (!task) {
      throw new NotFoundException('Tarefa nao encontrada');
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
      task.assigneeId = await this.resolveAssignee(projectId, dto.assigneeId);
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
      throw new NotFoundException('Tarefa nao encontrada');
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
   */
  async importCsv(projectId: string, actorId: string, csvText: string): Promise<ImportResult> {
    await this.accessService.requireRole(projectId, actorId, WRITE_ROLES);

    const rows = this.csvService.parse(csvText);
    const errors: ImportError[] = [];
    const tasks: Task[] = [];

    for (const [index, row] of rows.entries()) {
      const lineNumber = index + 2; // a linha 1 do CSV e o cabecalho
      const title = (row['titulo'] ?? '').trim();

      if (!title) {
        errors.push({ row: lineNumber, message: 'titulo e obrigatorio' });
        continue;
      }

      const statusRaw = (row['status'] ?? '').trim().toLowerCase();
      const status = (statusRaw || TaskStatus.Pendente) as TaskStatus;

      if (!TASK_STATUS_VALUES.includes(status)) {
        errors.push({ row: lineNumber, message: `status invalido: ${statusRaw}` });
        continue;
      }

      const email = (row['responsavel_email'] ?? '').trim().toLowerCase();
      let assigneeId: string | null = null;

      if (email) {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
          errors.push({ row: lineNumber, message: `usuario nao encontrado: ${email}` });
          continue;
        }

        const member = await this.membersRepository.findByProjectAndUser(projectId, user.id);
        if (!member) {
          errors.push({
            row: lineNumber,
            message: `responsavel nao e membro do projeto: ${email}`,
          });
          continue;
        }

        assigneeId = user.id;
      }

      const dueDate = (row['data_limite'] ?? '').trim();
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        errors.push({ row: lineNumber, message: `data_limite invalida: ${dueDate}` });
        continue;
      }

      tasks.push(
        this.tasksRepository.create({
          projectId,
          title,
          description: (row['descricao'] ?? '').trim() || null,
          status,
          assigneeId,
          dueDate: dueDate || null,
        }),
      );
    }

    const saved = tasks.length > 0 ? await this.tasksRepository.save(tasks) : [];

    return { created: saved.length, errors };
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

    const member = await this.membersRepository.findByProjectAndUser(projectId, assigneeId);
    if (!member) {
      throw new BadRequestException('O responsavel precisa ser membro do projeto');
    }

    return assigneeId;
  }

  private toView(task: Task): TaskView {
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
