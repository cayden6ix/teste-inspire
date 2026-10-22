import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { UsersService } from '../services/users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Busca usuarios por email (para adicionar membros ao projeto)',
  })
  search(@Query() query: ListUsersQueryDto) {
    return this.usersService.search(query.email);
  }
}
