import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';
import { ProjectMembersController } from './controllers/project-members.controller.js';
import { ProjectsController } from './controllers/projects.controller.js';
import { ProjectMember } from './entities/project-member.entity.js';
import { Project } from './entities/project.entity.js';
import { ProjectMembersRepository } from './repositories/project-members.repository.js';
import { ProjectsRepository } from './repositories/projects.repository.js';
import { ProjectAccessService } from './services/project-access.service.js';
import { ProjectMembersService } from './services/project-members.service.js';
import { ProjectsService } from './services/projects.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ProjectsController, ProjectMembersController],
  providers: [
    ProjectsRepository,
    ProjectMembersRepository,
    ProjectsService,
    ProjectMembersService,
    ProjectAccessService,
  ],
  exports: [
    ProjectsService,
    ProjectMembersService,
    ProjectAccessService,
    ProjectsRepository,
    ProjectMembersRepository,
  ],
})
export class ProjectsModule {}
