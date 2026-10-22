import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { PROJECT_ROLE_VALUES, ProjectRole } from '../../../common/enums/project-role.enum.js';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: PROJECT_ROLE_VALUES, description: 'Novo papel do membro (D-013)' })
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
