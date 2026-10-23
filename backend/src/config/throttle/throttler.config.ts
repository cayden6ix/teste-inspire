import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { seconds, type ThrottlerModuleOptions } from '@nestjs/throttler';
import {
  THROTTLE_SCOPE_KEY,
  ThrottleScope,
} from '../../common/decorators/throttle-scope.decorator.js';
import { STATUS_MESSAGES } from '../../common/messages/http-messages.js';

const reflector = new Reflector();

/** Rota marcada com `@RateLimitScope(scope)`? */
function hasScope(context: ExecutionContext, scope: ThrottleScope): boolean {
  return reflector.get<ThrottleScope | undefined>(THROTTLE_SCOPE_KEY, context.getHandler()) === scope;
}

/**
 * Rate limit por IP, configurado pelo ambiente:
 * - `default`: todas as rotas, THROTTLE_LIMIT requisicoes por janela;
 * - `auth-login` e `auth-register`: limites extras, so nas rotas marcadas com
 *   `@RateLimitScope`, contra forca bruta no login e cadastro em massa.
 *
 * A janela e THROTTLE_TTL_SECONDS para todos. THROTTLE_DISABLED=true desliga tudo
 * (testes). O IP vem de `req.ip`: atras de proxy, configure TRUST_PROXY.
 */
export function buildThrottlerOptions(config: ConfigService): ThrottlerModuleOptions {
  const disabled = config.get<boolean>('THROTTLE_DISABLED', false);
  const ttl = seconds(config.get<number>('THROTTLE_TTL_SECONDS', 60));
  const skipUnless = (scope: ThrottleScope) => (context: ExecutionContext) =>
    disabled || !hasScope(context, scope);

  return {
    errorMessage: STATUS_MESSAGES[429],
    throttlers: [
      {
        name: 'default',
        ttl,
        limit: config.get<number>('THROTTLE_LIMIT', 100),
        skipIf: () => disabled,
      },
      {
        name: 'auth-login',
        ttl,
        limit: config.get<number>('THROTTLE_AUTH_LOGIN_LIMIT', 10),
        skipIf: skipUnless(ThrottleScope.Login),
      },
      {
        name: 'auth-register',
        ttl,
        limit: config.get<number>('THROTTLE_AUTH_REGISTER_LIMIT', 5),
        skipIf: skipUnless(ThrottleScope.Register),
      },
    ],
  };
}
