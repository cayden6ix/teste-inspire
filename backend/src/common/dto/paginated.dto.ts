import { ApiProperty } from '@nestjs/swagger';

/**
 * Parametros de pagina ja validados, usados pelos repositories e pelo envelope.
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

/**
 * Metadados da pagina devolvidos junto com os itens.
 */
export class PaginationMeta {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 15 })
  limit: number;

  @ApiProperty({ example: 42, description: 'Total de registros que atendem aos filtros' })
  total: number;

  @ApiProperty({ example: 3, description: '0 quando total = 0; senao ceil(total / limit)' })
  totalPages: number;
}

/**
 * Envelope padrao das listagens paginadas: `{ data, meta }`.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
