import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { CreateTaskDto } from '../dto/create-task.dto.js';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto.js';
import { UpdateTaskDto } from '../dto/update-task.dto.js';
import { ImportResult, TasksService } from '../services/tasks.service.js';

interface UploadedCsvFile {
  buffer: Buffer;
  originalname: string;
}

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Lista as tarefas do projeto' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.list(projectId, user.id, {
      status: query.status,
      assigneeId: query.assigneeId,
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Exporta as tarefas do projeto em CSV (D-014)' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const csv = await this.tasksService.exportCsv(projectId, user.id);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="tarefas-${projectId}.csv"`);

    return csv;
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('text/csv', 'multipart/form-data')
  @ApiBody({
    description: 'CSV com as colunas titulo,descricao,status,responsavel_email,data_limite',
    schema: { type: 'string' },
  })
  @ApiOperation({ summary: 'Importa tarefas em massa a partir de um CSV (D-014)' })
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() body: unknown,
  ): Promise<ImportResult> {
    const csvText = file
      ? file.buffer.toString('utf8')
      : typeof body === 'string'
        ? body
        : '';

    if (!csvText.trim()) {
      throw new BadRequestException(
        'Envie o CSV no corpo da requisicao (text/csv) ou no campo file (multipart/form-data)',
      );
    }

    return this.tasksService.importCsv(projectId, user.id, csvText);
  }

  @Post()
  @ApiOperation({ summary: 'Cria uma tarefa no projeto' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, user.id, dto);
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Detalha uma tarefa do projeto' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.tasksService.findOne(projectId, taskId, user.id);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Atualiza uma tarefa do projeto' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, user.id, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui uma tarefa do projeto' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ): Promise<void> {
    await this.tasksService.remove(projectId, taskId, user.id);
  }
}
