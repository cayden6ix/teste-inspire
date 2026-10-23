import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../src/common/validation/validation.pipe.js';

export type ResultadoValidacao<T> =
  | { valido: true; instancia: T; mensagens: [] }
  | { valido: false; instancia: undefined; mensagens: string[] };

/**
 * Valida `plain` contra o DTO como o pipe global faria em `@Body()` ou `@Query()`.
 */
export async function validarDto<T extends object>(
  dto: new () => T,
  plain: unknown,
  tipo: 'body' | 'query' = 'body',
): Promise<ResultadoValidacao<T>> {
  try {
    const instancia = (await createValidationPipe().transform(plain, {
      type: tipo,
      metatype: dto,
    })) as T;
    return { valido: true, instancia, mensagens: [] };
  } catch (error) {
    if (error instanceof BadRequestException) {
      const { message } = error.getResponse() as { message: string[] };
      return { valido: false, instancia: undefined, mensagens: message };
    }
    throw error;
  }
}
