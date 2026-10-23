import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SortablePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import { PROJECT_SORT_FIELDS, type ProjectSortField } from '../projects.types.js';

export class ListProjectsQueryDto extends SortablePaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Busca parcial (sem diferenciar maiusculas) em nome e descricao',
  })
  @IsOptional()
  @Trim({ emptyToUndefined: true })
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: PROJECT_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(PROJECT_SORT_FIELDS)
  sortBy?: ProjectSortField;
}
