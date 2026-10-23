import { Injectable } from '@nestjs/common';
import { READ_ROLES } from '../../../common/enums/project-role.enum.js';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { ProjectAccessService } from '../../projects/services/project-access.service.js';
import { TasksService } from '../../tasks/services/tasks.service.js';
import type { TaskAssigneeCount } from '../../tasks/tasks.types.js';
import { ReportGroupBy } from '../dto/reports-query.dto.js';
import { ReportGroupDto, ReportResponseDto } from '../dto/report-response.dto.js';

const UNASSIGNED_KEY = 'sem_responsavel';

const UNASSIGNED_LABEL = 'Sem responsável';

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.Pendente]: 'Pendente',
  [TaskStatus.EmAndamento]: 'Em andamento',
  [TaskStatus.Concluida]: 'Concluída',
};

/**
 * Relatorios agregados (D-015).
 *
 * A contagem e feita no banco (GROUP BY por status e por responsavel); aqui so se
 * monta a resposta. Sem `projectId`, entram todos os projetos em que o usuario e membro.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly accessService: ProjectAccessService,
  ) {}

  async build(
    userId: string,
    groupBy: ReportGroupBy = ReportGroupBy.Status,
    projectId?: string,
  ): Promise<ReportResponseDto> {
    const projectIds = await this.resolveProjectIds(userId, projectId);

    const byStatus: Record<TaskStatus, number> = {
      [TaskStatus.Pendente]: 0,
      [TaskStatus.EmAndamento]: 0,
      [TaskStatus.Concluida]: 0,
    };

    for (const { status, count } of await this.tasksService.countByStatus(projectIds)) {
      byStatus[status] = count;
    }

    const groups =
      groupBy === ReportGroupBy.User
        ? this.groupByUser(await this.tasksService.countByAssignee(projectIds))
        : this.groupByStatus(byStatus);

    return {
      groupBy,
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      groups,
    };
  }

  private async resolveProjectIds(userId: string, projectId?: string): Promise<string[]> {
    if (projectId) {
      await this.accessService.requireRole(projectId, userId, READ_ROLES);
      return [projectId];
    }

    return this.accessService.listProjectIdsOfUser(userId);
  }

  private groupByStatus(byStatus: Record<TaskStatus, number>): ReportGroupDto[] {
    return Object.values(TaskStatus).map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      count: byStatus[status],
    }));
  }

  private groupByUser(counts: TaskAssigneeCount[]): ReportGroupDto[] {
    const groups = counts.map(({ assigneeId, assigneeName, count }) => ({
      key: assigneeId ?? UNASSIGNED_KEY,
      label: assigneeName ?? UNASSIGNED_LABEL,
      count,
    }));

    // Desempate por key: dois responsaveis com o mesmo nome nao trocam de posicao entre execucoes.
    return groups.sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label) || a.key.localeCompare(b.key),
    );
  }
}
