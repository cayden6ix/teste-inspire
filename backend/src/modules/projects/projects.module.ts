import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module.js';
import { ProjectMembersController } from './controllers/project-members.controller.js';
import { ProjectsController } from './controllers/projects.controller.js';
import { UserSearchController } from './controllers/user-search.controller.js';
import { ProjectMember } from './entities/project-member.entity.js';
import { Project } from './entities/project.entity.js';
import { ProjectMembersRepository } from './repositories/project-members.repository.js';
import { ProjectsRepository } from './repositories/projects.repository.js';
import { ProjectAccessService } from './services/project-access.service.js';
import { ProjectMembersService } from './services/project-members.service.js';
import { ProjectsService } from './services/projects.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMember]), UsersModule],
  // UserSearchController: GET /users, a busca de quem adicionar como membro (D-028).
  controllers: [ProjectsController, ProjectMembersController, UserSearchController],
  providers: [
    ProjectsRepository,
    ProjectMembersRepository,
    ProjectsService,
    ProjectMembersService,
    ProjectAccessService,
  ],
  // Outros modulos (tarefas, relatorios) usam apenas o ProjectAccessService.
  exports: [ProjectAccessService],
})
export class ProjectsModule {}
