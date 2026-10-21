import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export type RequestWithId = Request & { id?: string };

/**
 * Atribui um identificador de correlacao a cada requisicao.
 *
 * O `x-request-id` recebido e reaproveitado quando presente, o que permite
 * correlacionar requisicoes entre o frontend, a API e os logs.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const id = request.header('x-request-id') ?? randomUUID();

    request.id = id;
    response.setHeader('x-request-id', id);

    next();
  }
}
