import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { buildValidationException } from '../../src/common/validation/validation-exception.factory.js';

/** Mesma configuracao do ValidationPipe global de `src/main.ts`. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: buildValidationException,
  });
}

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
