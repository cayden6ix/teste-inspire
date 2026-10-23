import { ApiProperty } from '@nestjs/swagger';
import { PROJECT_ROLE_VALUES, ProjectRole } from '../../../common/enums/project-role.enum.js';

/**
 * Projeto visto pelo usuario autenticado, com o papel dele no projeto.
 */
export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid', example: '0c9e4a7b-3f1d-4b2e-8d6a-5e7f1a2b3c4d' })
  id: string;

  @ApiProperty({ example: 'Portal do Cliente' })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'Portal web para o cliente final' })
  description: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiProperty({
    enum: PROJECT_ROLE_VALUES,
    description: 'Papel do usuario autenticado neste projeto (owner > admin > member > viewer)',
  })
  role: ProjectRole;
}
