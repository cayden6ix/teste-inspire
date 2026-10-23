import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import { IsDateOnly } from '../../../common/decorators/is-date-only.decorator.js';
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '../tasks.types.js';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Tarefa 1 (editada)' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TASK_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Trim({ emptyToNull: true })
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ApiPropertyOptional({ enum: TASK_STATUS_VALUES })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-02-01',
    nullable: true,
    description: 'Data limite (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsDateOnly()
  dueDate?: string | null;
}
