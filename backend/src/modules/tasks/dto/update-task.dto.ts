import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Tarefa 1 (editada)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TASK_STATUS_VALUES })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({ example: '2026-02-01', nullable: true })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;
}
