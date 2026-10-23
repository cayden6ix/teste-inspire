import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 429;

const ERROR_DESCRIPTIONS: Record<ApiErrorStatus, string> = {
  400: 'Requisição inválida: validação do corpo ou da query, ou parâmetro malformado (ex.: UUID inválido)',
  401: 'Token ausente, inválido ou expirado',
  403: 'Usuário fora do projeto ou sem papel suficiente para esta ação',
  404: 'Recurso não encontrado',
  409: 'Conflito com um registro existente',
  413: 'Arquivo ou corpo acima do tamanho permitido (CSV: até 5 MB, 1 arquivo)',
  429: 'Limite de requisições por IP excedido; tente de novo após o tempo indicado em Retry-After',
};

/**
 * Documenta os erros possiveis de um endpoint com o schema comum `ErrorResponseDto`.
 *
 * Uso: `@ApiErrorResponses(400, 401, 403, 404)`.
 */
export function ApiErrorResponses(...statuses: ApiErrorStatus[]) {
  return applyDecorators(
    ...statuses.map((status) =>
      ApiResponse({
        status,
        description: ERROR_DESCRIPTIONS[status],
        type: ErrorResponseDto,
      }),
    ),
  );
}
