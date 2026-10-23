import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { ReportsController } from './controllers/reports.controller.js';
import { ReportsService } from './services/reports.service.js';

@Module({
  imports: [ProjectsModule, TasksModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
