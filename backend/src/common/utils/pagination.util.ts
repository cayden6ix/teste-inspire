import { SortOrder } from '../enums/sort-order.enum.js';
import { PaginatedResponse, PaginationParams } from '../dto/paginated.dto.js';

/**
 * Monta o envelope `{ data, meta }` a partir da pagina e do total de registros.
 *
 * `totalPages` e 0 quando nao ha registros (total = 0); caso contrario,
 * `ceil(total / limit)`.
 */
export function toPaginatedResponse<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationParams,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}

/**
 * Converte a direcao da ordenacao para o formato aceito pelo TypeORM.
 */
export function toSqlDirection(order: SortOrder): 'ASC' | 'DESC' {
  return order === SortOrder.Asc ? 'ASC' : 'DESC';
}
