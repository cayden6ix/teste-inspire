import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../constants/pagination.constants.js';
import { SORT_ORDER_VALUES, SortOrder } from '../enums/sort-order.enum.js';

/**
 * Parametros de paginacao aceitos por todas as listagens paginadas.
 *
 * Valores fora da faixa (page < 1, limit fora de 1..100) geram 400.
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    default: DEFAULT_PAGE,
    description: 'Numero da pagina (comeca em 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    description: 'Quantidade de itens por pagina',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}

/**
 * Paginacao com ordenacao. Cada listagem declara o proprio `sortBy`
 * com uma whitelist de campos; a direcao (`order`) e comum a todas.
 */
export class SortablePaginationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: SORT_ORDER_VALUES,
    description: 'Direcao da ordenacao (o padrao depende da listagem)',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
