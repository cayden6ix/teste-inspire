import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ProjectMember } from '../entities/project-member.entity.js';

@Injectable()
export class ProjectMembersRepository extends Repository<ProjectMember> {
  constructor(private dataSource: DataSource) {
    super(ProjectMember, dataSource.createEntityManager());
  }

  findByProject(projectId: string): Promise<ProjectMember[]> {
    return this.find({ where: { projectId }, relations: { user: true } });
  }

  findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null> {
    return this.findOne({ where: { projectId, userId } });
  }

  findByUser(userId: string): Promise<ProjectMember[]> {
    return this.find({ where: { userId } });
  }
}
