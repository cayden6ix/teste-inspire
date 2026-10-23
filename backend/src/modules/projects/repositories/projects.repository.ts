import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { ProjectMember } from '../entities/project-member.entity.js';
import { Project } from '../entities/project.entity.js';

@Injectable()
export class ProjectsRepository extends Repository<Project> {
  constructor(private dataSource: DataSource) {
    super(Project, dataSource.createEntityManager());
  }

  /**
   * Cria o projeto e o vinculo do autor como `owner` na mesma transacao:
   * se uma das gravacoes falhar, nao sobra projeto sem dono (D-013).
   */
  createWithOwner(data: Pick<Project, 'name' | 'description'>, ownerId: string): Promise<Project> {
    return this.manager.transaction(async (manager) => {
      const project = await manager.save(manager.create(Project, data));

      await manager.save(
        manager.create(ProjectMember, {
          projectId: project.id,
          userId: ownerId,
          role: ProjectRole.Owner,
        }),
      );

      return project;
    });
  }
}
