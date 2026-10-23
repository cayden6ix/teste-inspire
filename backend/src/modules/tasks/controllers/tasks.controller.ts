import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { PARSE_UUID_PIPE } from '../../../common/pipes/parse-uuid.pipe.js';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator.js';
import { ApiUuidParam } from '../../../common/decorators/api-uuid-param.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { CSV_IMPORT_MAX_ROWS, CSV_UPLOAD_LIMITS } from '../../../common/constants/upload.constants.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { CreateTaskDto } from '../dto/create-task.dto.js';
import { ImportResultDto } from '../dto/import-result.dto.js';
import { ListTasksQueryDto } from '../dto/list-tasks-query.dto.js';
import { TaskResponseDto } from '../dto/task-response.dto.js';
import { UpdateTaskDto } from '../dto/update-task.dto.js';
import { resolveCsvUpload } from '../services/tasks-csv.service.js';
import { TasksService } from '../services/tasks.service.js';

interface UploadedCsvFile {
  buffer: Buffer;
  originalname: string;
}

const CSV_COLUMNS_DESCRIPTION =
  'Colunas (cabecalho obrigatorio): titulo (obrigatorio), descricao, status (pendente | em_andamento | concluida; vazio = pendente), ' +
  'responsavel_email (deve ser membro do projeto; vazio = sem responsavel), data_limite (YYYY-MM-DD; vazio = sem data). ' +
  'Linhas validas sao importadas; linhas invalidas nao interrompem a importacao e voltam em errors[] com o numero da linha (1 = cabecalho). ' +
  'Protecao contra formulas: valores que comecam com =, +, -, @, tab ou CR saem com um apostrofo na frente na exportacao; ' +
  'na importacao, um apostrofo inicial seguido desses caracteres e removido (exportar e importar de volta preserva o texto).';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiUuidParam('projectId')
  @ApiPaginatedResponse(TaskResponseDto)
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Lista as tarefas do projeto (paginada, com filtros e ordenacao)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Query() query: ListTasksQueryDto,
  ) {
    return this.tasksService.list(projectId, user.id, query);
  }

  @Get('export')
  @ApiUuidParam('projectId')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: `Arquivo CSV com todas as tarefas do projeto (nao paginado). ${CSV_COLUMNS_DESCRIPTION}`,
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          example:
            'titulo,descricao,status,responsavel_email,data_limite\nModelar o banco,Definir tabelas,em_andamento,bruno.lima@empresa.com,2026-11-01',
        },
      },
    },
    headers: {
      'Content-Disposition': {
        description: 'Anexo com o nome do arquivo',
        schema: { type: 'string', example: 'attachment; filename="tarefas-<projectId>.csv"' },
      },
    },
  })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Exporta todas as tarefas do projeto em CSV (D-014)' })
  async exportCsv(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const csv = await this.tasksService.exportCsv(projectId, user.id);

    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="tarefas-${projectId}.csv"`);

    return csv;
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: CSV_UPLOAD_LIMITS }))
  @ApiUuidParam('projectId')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Arquivo CSV com as colunas titulo,descricao,status,responsavel_email,data_limite',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Arquivo CSV',
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: ImportResultDto,
    description: 'Contagem de tarefas criadas e as linhas rejeitadas em errors[]',
  })
  @ApiErrorResponses(400, 401, 403, 404, 413)
  @ApiOperation({
    summary: 'Importa tarefas em massa a partir de um CSV (D-014)',
    description:
      'Colunas: titulo,descricao,status,responsavel_email,data_limite; data no formato YYYY-MM-DD. ' +
      'Linhas validas sao importadas; as invalidas voltam em errors[] com o numero da linha (1 = cabecalho). ' +
      'Tambem aceita o CSV puro no corpo com Content-Type text/csv. Limite: 5 MB e 1 arquivo (413 acima disso) ' +
      `e ${CSV_IMPORT_MAX_ROWS} linhas de dados (400 acima disso, sem importar nada). ` +
      'Valor iniciado por apostrofo seguido de =, +, -, @, tab ou CR perde o apostrofo (escape da exportacao).',
  })
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @UploadedFile() file: UploadedCsvFile | undefined,
    @Body() body: unknown,
    @Headers('content-type') contentType: string | undefined,
  ): Promise<ImportResultDto> {
    // Arquivo vazio (0 bytes) e ausencia de arquivo tem mensagens distintas (D-030).
    const csvText = resolveCsvUpload(file, body, contentType);

    return this.tasksService.importCsv(projectId, user.id, csvText);
  }

  @Post()
  @ApiUuidParam('projectId')
  @ApiCreatedResponse({ type: TaskResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Cria uma tarefa no projeto' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(projectId, user.id, dto);
  }

  @Get(':taskId')
  @ApiUuidParam('projectId')
  @ApiUuidParam('taskId')
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Detalha uma tarefa do projeto' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Param('taskId', PARSE_UUID_PIPE) taskId: string,
  ) {
    return this.tasksService.findOne(projectId, taskId, user.id);
  }

  @Patch(':taskId')
  @ApiUuidParam('projectId')
  @ApiUuidParam('taskId')
  @ApiOkResponse({ type: TaskResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Atualiza uma tarefa do projeto' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Param('taskId', PARSE_UUID_PIPE) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, user.id, dto);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiUuidParam('projectId')
  @ApiUuidParam('taskId')
  @ApiNoContentResponse({ description: 'Tarefa excluida' })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Exclui uma tarefa do projeto' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Param('taskId', PARSE_UUID_PIPE) taskId: string,
  ): Promise<void> {
    await this.tasksService.remove(projectId, taskId, user.id);
  }
}
