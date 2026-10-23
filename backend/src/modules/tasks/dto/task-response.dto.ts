import { ApiProperty } from '@nestjs/swagger';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';

/**
 * Tarefa de um projeto, com o nome do responsavel quando houver.
 */
export class TaskResponseDto {
  @ApiProperty({ format: 'uuid', example: '9a1f3c5e-7b2d-4e6f-8a0c-1d3e5f7a9b2c' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  projectId: string;

  @ApiProperty({ example: 'Modelar o banco de dados' })
  title: string;

  @ApiProperty({ type: String, nullable: true, example: 'Definir tabelas e relacionamentos' })
  description: string | null;

  @ApiProperty({ enum: TASK_STATUS_VALUES, description: 'Status da tarefa (D-012)' })
  status: TaskStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Responsavel (membro do projeto)' })
  assigneeId: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Bruno Lima' })
  assigneeName: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-11-01',
    description: 'Data limite no formato YYYY-MM-DD',
  })
  dueDate: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}
