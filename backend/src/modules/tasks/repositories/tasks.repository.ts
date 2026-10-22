import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, In, Repository } from 'typeorm';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { Task } from '../entities/task.entity.js';

export interface TaskFilters {
  status?: TaskStatus;
  assigneeId?: string;
}

@Injectable()
export class TasksRepository extends Repository<Task> {
  constructor(private dataSource: DataSource) {
    super(Task, dataSource.createEntityManager());
  }

  findByProject(projectId: string, filters: TaskFilters = {}): Promise<Task[]> {
    const where: FindOptionsWhere<Task> = { projectId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.assigneeId) {
      where.assigneeId = filters.assigneeId;
    }

    return this.find({
      where,
      relations: { assignee: true },
      order: { createdAt: 'DESC' },
    });
  }

  findByProjectAndId(projectId: string, id: string): Promise<Task | null> {
    return this.findOne({ where: { id, projectId }, relations: { assignee: true } });
  }

  findByProjectIds(projectIds: string[]): Promise<Task[]> {
    return this.find({ where: { projectId: In(projectIds) }, relations: { assignee: true } });
  }
}
