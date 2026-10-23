import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMeta } from '../dto/paginated.dto.js';

/**
 * Documenta no Swagger a resposta `200` de uma listagem paginada:
 * `{ data: Item[], meta: PaginationMeta }`.
 */
export function ApiPaginatedResponse(itemModel: Type<unknown>) {
  return applyDecorators(
    ApiExtraModels(PaginationMeta, itemModel),
    ApiOkResponse({
      schema: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: getSchemaPath(itemModel) } },
          meta: { $ref: getSchemaPath(PaginationMeta) },
        },
      },
    }),
  );
}
