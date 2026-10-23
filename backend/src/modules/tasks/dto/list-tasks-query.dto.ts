import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { SortablePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { TASK_STATUS_VALUES, TaskStatus } from '../../../common/enums/task-status.enum.js';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import { IsDateOnly } from '../../../common/decorators/is-date-only.decorator.js';
import { TASK_SORT_FIELDS, type TaskSortField } from '../tasks.types.js';

export class ListTasksQueryDto extends SortablePaginationQueryDto {
  @ApiPropertyOptional({ enum: TASK_STATUS_VALUES })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Busca parcial (sem diferenciar maiusculas) em titulo e descricao',
  })
  @IsOptional()
  @Trim({ emptyToUndefined: true })
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Data limite minima (YYYY-MM-DD, inclusiva)',
  })
  @IsOptional()
  @IsDateOnly()
  dueFrom?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Data limite maxima (YYYY-MM-DD, inclusiva)',
  })
  @IsOptional()
  @IsDateOnly()
  dueTo?: string;

  @ApiPropertyOptional({ enum: TASK_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(TASK_SORT_FIELDS)
  sortBy?: TaskSortField;
}
