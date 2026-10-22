import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';

export class CreateTaskDto {
  @ApiProperty({ example: 'Tarefa 1' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Detalhe da tarefa', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TASK_STATUS_VALUES, default: TaskStatus.Pendente })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Membro do projeto responsavel', nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ example: '2026-02-01', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
