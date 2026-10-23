import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { id?: string };

/** Ids aceitos do cliente: ate 64 caracteres entre letras, digitos, `_` e `-` (ex.: UUID). */
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/;

/**
 * Atribui um identificador de correlacao a cada requisicao.
 *
 * O `x-request-id` recebido e reaproveitado quando tem um formato seguro, o que
 * permite correlacionar requisicoes entre o frontend, a API e os logs. Valores
 * fora do formato (longos ou com quebras de linha, que poderiam forjar linhas de
 * log) sao descartados e um UUID novo e gerado.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const received = request.header('x-request-id');
    const id = received && REQUEST_ID_PATTERN.test(received) ? received : randomUUID();

    request.id = id;
    response.setHeader('x-request-id', id);

    next();
  }
}
