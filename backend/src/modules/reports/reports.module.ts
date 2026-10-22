import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { ReportsController } from './controllers/reports.controller.js';
import { ReportsService } from './services/reports.service.js';

@Module({
  imports: [AuthModule, ProjectsModule, TasksModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
