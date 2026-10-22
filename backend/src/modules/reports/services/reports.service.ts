import { Injectable } from '@nestjs/common';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { ProjectMembersRepository } from '../../projects/repositories/project-members.repository.js';
import { ProjectAccessService } from '../../projects/services/project-access.service.js';
import { ReportGroupBy } from '../dto/reports-query.dto.js';
import { Task } from '../../tasks/entities/task.entity.js';
import { TasksRepository } from '../../tasks/repositories/tasks.repository.js';

export interface ReportGroup {
  key: string;
  label: string;
  count: number;
}

export interface ReportView {
  groupBy: ReportGroupBy;
  total: number;
  byStatus: Record<TaskStatus, number>;
  groups: ReportGroup[];
}

const UNASSIGNED_KEY = 'sem_responsavel';

/**
 * Relatorios agregados (D-015).
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly tasksRepository: TasksRepository,
    private readonly membersRepository: ProjectMembersRepository,
    private readonly accessService: ProjectAccessService,
  ) {}

  async build(
    userId: string,
    groupBy: ReportGroupBy = ReportGroupBy.Status,
    projectId?: string,
  ): Promise<ReportView> {
    const tasks = await this.collectTasks(userId, projectId);

    const byStatus: Record<TaskStatus, number> = {
      [TaskStatus.Pendente]: 0,
      [TaskStatus.EmAndamento]: 0,
      [TaskStatus.Concluida]: 0,
    };

    for (const task of tasks) {
      byStatus[task.status] += 1;
    }

    const groups =
      groupBy === ReportGroupBy.User ? this.groupByUser(tasks) : this.groupByStatus(byStatus);

    return {
      groupBy,
      total: tasks.length,
      byStatus,
      groups,
    };
  }

  private async collectTasks(userId: string, projectId?: string): Promise<Task[]> {
    if (projectId) {
      await this.accessService.requireRole(projectId, userId, [
        ProjectRole.Owner,
        ProjectRole.Admin,
        ProjectRole.Member,
        ProjectRole.Viewer,
      ]);

      return this.tasksRepository.findByProject(projectId);
    }

    const memberships = await this.membersRepository.findByUser(userId);
    if (memberships.length === 0) {
      return [];
    }

    return this.tasksRepository.findByProjectIds(memberships.map((m) => m.projectId));
  }

  private groupByStatus(byStatus: Record<TaskStatus, number>): ReportGroup[] {
    return Object.values(TaskStatus).map((status) => ({
      key: status,
      label: status,
      count: byStatus[status],
    }));
  }

  private groupByUser(tasks: Task[]): ReportGroup[] {
    const groups = new Map<string, ReportGroup>();

    for (const task of tasks) {
      const key = task.assigneeId ?? UNASSIGNED_KEY;
      const label = task.assignee?.name ?? 'Sem responsavel';
      const current = groups.get(key);

      if (current) {
        current.count += 1;
        continue;
      }

      groups.set(key, { key, label, count: 1 });
    }

    return [...groups.values()].sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label),
    );
  }
}
