import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiErrorResponses } from '../../../common/decorators/api-error-responses.decorator.js';
import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { UserResponseDto } from '../dto/user-response.dto.js';
import { UsersService } from '../services/users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiPaginatedResponse(UserResponseDto)
  @ApiErrorResponses(400, 401)
  @ApiOperation({
    summary: 'Busca paginada de usuarios por nome ou email (para adicionar membros ao projeto)',
    description:
      'Exige email ou name com pelo menos 3 caracteres (apos o trim); sem isso devolve 400. ' +
      'A busca e parcial e nao diferencia maiusculas.',
  })
  search(@Query() query: ListUsersQueryDto) {
    return this.usersService.search(query);
  }
}
