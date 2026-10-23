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
import { AddMemberDto } from '../dto/add-member.dto.js';
import { ListMembersQueryDto } from '../dto/list-members-query.dto.js';
import { ProjectMemberResponseDto } from '../dto/project-member-response.dto.js';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto.js';
import { ProjectMembersService } from '../services/project-members.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  @ApiUuidParam('projectId')
  @ApiPaginatedResponse(ProjectMemberResponseDto)
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({ summary: 'Lista paginada dos membros do projeto (filtro por papel)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.membersService.list(projectId, user.id, query);
  }

  @Post()
  @ApiUuidParam('projectId')
  @ApiCreatedResponse({ type: ProjectMemberResponseDto })
  @ApiErrorResponses(400, 401, 403, 404, 409)
  @ApiOperation({
    summary: 'Adiciona um membro ao projeto',
    description:
      'owner atribui admin, member ou viewer; admin so atribui member ou viewer. ' +
      'O papel owner nao pode ser atribuido (nasce na criacao do projeto): 400.',
  })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.membersService.add(projectId, user.id, dto);
  }

  @Patch(':userId')
  @ApiUuidParam('projectId')
  @ApiUuidParam('userId')
  @ApiOkResponse({ type: ProjectMemberResponseDto })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({
    summary: 'Altera o papel de um membro',
    description:
      'owner altera qualquer membro, exceto a si mesmo e o owner; admin so altera member/viewer ' +
      'e so atribui member ou viewer. Alterar o proprio papel ou atribuir owner: 400.',
  })
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Param('userId', PARSE_UUID_PIPE) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(projectId, user.id, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiUuidParam('projectId')
  @ApiUuidParam('userId')
  @ApiNoContentResponse({ description: 'Membro removido do projeto' })
  @ApiErrorResponses(400, 401, 403, 404)
  @ApiOperation({
    summary: 'Remove um membro do projeto',
    description:
      'owner remove qualquer membro, exceto a si mesmo e o owner; admin so remove member/viewer. ' +
      'As tarefas do membro removido nesse projeto ficam sem responsavel.',
  })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', PARSE_UUID_PIPE) projectId: string,
    @Param('userId', PARSE_UUID_PIPE) userId: string,
  ): Promise<void> {
    await this.membersService.remove(projectId, user.id, userId);
  }
}
