import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

/**
 * ThrottlerGuard que sempre devolve o `Retry-After` padrao no 429.
 *
 * O guard da biblioteca so usa `Retry-After` no limite `default`; nos limites
 * nomeados (login, cadastro) o cabecalho vira `Retry-After-<nome>`, que clientes
 * HTTP nao reconhecem.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<void> {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', throttlerLimitDetail.timeToBlockExpire);

    await super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
