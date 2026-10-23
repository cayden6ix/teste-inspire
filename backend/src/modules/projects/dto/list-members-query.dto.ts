import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { PROJECT_ROLE_VALUES, ProjectRole } from '../../../common/enums/project-role.enum.js';

export class ListMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PROJECT_ROLE_VALUES, description: 'Filtra os membros pelo papel' })
  @IsOptional()
  @IsEnum(ProjectRole)
  role?: ProjectRole;
}
