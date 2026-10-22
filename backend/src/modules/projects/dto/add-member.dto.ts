import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { PROJECT_ROLE_VALUES, ProjectRole } from '../../../common/enums/project-role.enum.js';

export class AddMemberDto {
  @ApiProperty({ format: 'uuid', description: 'Id do usuario que sera membro do projeto' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: PROJECT_ROLE_VALUES, description: 'Papel do membro no projeto (D-013)' })
  @IsEnum(ProjectRole)
  role: ProjectRole;
}
