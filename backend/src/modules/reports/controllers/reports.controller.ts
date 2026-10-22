import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ReportsQueryDto } from '../dto/reports-query.dto.js';
import { ReportsService } from '../services/reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Relatorio agregado de tarefas (D-015)' })
  build(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportsQueryDto) {
    return this.reportsService.build(user.id, query.groupBy, query.projectId);
  }
}
