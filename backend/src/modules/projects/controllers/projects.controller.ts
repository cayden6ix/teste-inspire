import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PARSE_UUID_PIPE } from '../../../common/pipes/parse-uuid.pipe.js';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator.js';
import { ApiUuidParam } from '../../../common/decorators/api-uuid-param.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { CreateProjectDto } from '../dto/create-project.dto.js';
import { ListProjectsQueryDto } from '../dto/list-projects-query.dto.js';
import { ProjectResponseDto } from '../dto/project-response.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';
import { ProjectsService } from '../services/projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiCreatedResponse({ type: ProjectResponseDto })
  @ApiErrorResponses(400, 401)
  @ApiOperation({ summary: 'Cria um projeto (o autor vira owner)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get()
  @ApiPaginatedResponse(ProjectResponseDto)
  @ApiErrorResponses(400, 401)
  @ApiOperation({ summary: 'Lista paginada dos projetos em que o usuario e membro' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListProjectsQueryDto) {
    return this.projectsService.listForUser(user.id, query);
  }

  @Get(':projectId')
  @ApiUuidParam('projectId')
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Detalha um projeto' })
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
  ) {
    return this.projectsService.findOneForUser(projectId, user.id);
  }

  @Patch(':projectId')
  @ApiUuidParam('projectId')
  @ApiOkResponse({ type: ProjectResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Atualiza um projeto (owner/admin)' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(projectId, user.id, dto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiUuidParam('projectId')
  @ApiNoContentResponse({ description: 'Projeto excluido' })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Exclui um projeto (owner)' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
  ): Promise<void> {
    await this.projectsService.remove(projectId, user.id);
  }
}
