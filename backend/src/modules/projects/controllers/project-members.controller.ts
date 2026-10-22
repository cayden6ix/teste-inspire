import {
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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { AddMemberDto } from '../dto/add-member.dto.js';
import { UpdateMemberRoleDto } from '../dto/update-member-role.dto.js';
import { ProjectMembersService } from '../services/project-members.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/members')
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os membros do projeto' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.membersService.list(projectId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Adiciona um membro ao projeto' })
  add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.membersService.add(projectId, user.id, dto);
  }

  @Patch(':userId')
  @ApiOperation({ summary: 'Altera o papel de um membro' })
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(projectId, user.id, userId, dto);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove um membro do projeto' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('userId', new ParseUUIDPipe()) userId: string,
  ): Promise<void> {
    await this.membersService.remove(projectId, user.id, userId);
  }
}
