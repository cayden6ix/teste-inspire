import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { ReportsQueryDto } from '../dto/reports-query.dto.js';
import { ReportResponseDto } from '../dto/report-response.dto.js';
import { ReportsService } from '../services/reports.service.js';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @ApiOkResponse({ type: ReportResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Relatorio agregado de tarefas (D-015)' })
  build(@CurrentUser() user: AuthenticatedUser, @Query() query: ReportsQueryDto) {
    return this.reportsService.build(user.id, query.groupBy, query.projectId);
  }
}
