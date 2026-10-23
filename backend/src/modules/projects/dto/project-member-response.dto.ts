import { ApiProperty } from '@nestjs/swagger';
import { PROJECT_ROLE_VALUES, ProjectRole } from '../../../common/enums/project-role.enum.js';

/**
 * Membro de um projeto, com dados publicos do usuario.
 */
export class ProjectMemberResponseDto {
  @ApiProperty({ format: 'uuid', description: 'Id vinculo do membro (project_members)' })
  id: string;

  @ApiProperty({ format: 'uuid', description: 'Id do usuario' })
  userId: string;

  @ApiProperty({ example: 'Carla Dias' })
  name: string;

  @ApiProperty({ format: 'email', example: 'carla.dias@empresa.com' })
  email: string;

  @ApiProperty({ enum: PROJECT_ROLE_VALUES })
  role: ProjectRole;
}
