import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator.js';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../../shared/types/authenticated-user.js';
import { ListUsersQueryDto } from '../../users/dto/list-users-query.dto.js';
import { UserResponseDto } from '../../users/dto/user-response.dto.js';
import { ProjectMembersService } from '../services/project-members.service.js';

/**
 * `GET /users`: busca de pessoas para adicionar a um projeto (D-028).
 *
 * Fica no modulo de projetos porque a regra de quem pode buscar (owner ou admin de
 * algum projeto) e de membros; o modulo de usuarios so faz a busca.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserSearchController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  @ApiPaginatedResponse(UserResponseDto)
  @ApiErrorResponses(400, 401, 403)
  @ApiOperation({
    summary: 'Busca paginada de usuarios por nome ou email (para adicionar membros ao projeto)',
    description:
      'So para quem e owner ou admin de pelo menos um projeto (senao 403). Exige email ou name ' +
      'com pelo menos 3 caracteres (apos o trim; senao 400). A busca e parcial e nao diferencia ' +
      'maiusculas nem acentos. No maximo 10 itens por pagina; a resposta traz so id, name e email.',
  })
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersQueryDto) {
    return this.membersService.searchUsers(user.id, query);
  }
}
