import { ValidationPipe } from '@nestjs/common';
import { buildValidationException } from './validation-exception.factory.js';

/**
 * ValidationPipe global da API (usado pelo `configureApp` e pelos testes).
 *
 * - `whitelist` + `forbidNonWhitelisted`: campo fora do DTO e 400;
 * - `transform`: o handler recebe a instancia do DTO (com `@Trim` e `@Type` aplicados);
 * - SEM conversao implicita de tipos: um `title` numerico (JSON `123`) continua numero e
 *   cai no `@IsString` (400), em vez de virar o texto "123" em silencio. A query string
 *   chega sempre como texto, entao os campos numericos dela declaram `@Type(() => Number)`
 *   (ver `PaginationQueryDto`).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    exceptionFactory: buildValidationException,
  });
}
