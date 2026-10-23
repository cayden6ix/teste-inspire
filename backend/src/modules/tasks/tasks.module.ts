import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { TasksController } from './controllers/tasks.controller.js';
import { Task } from './entities/task.entity.js';
import { TasksRepository } from './repositories/tasks.repository.js';
import { TasksCsvService } from './services/tasks-csv.service.js';
import { TasksService } from './services/tasks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), UsersModule, ProjectsModule],
  controllers: [TasksController],
  providers: [TasksRepository, TasksService, TasksCsvService],
  exports: [TasksService],
})
export class TasksModule {}
