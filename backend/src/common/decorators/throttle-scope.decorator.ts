import { SetMetadata } from '@nestjs/common';

export const THROTTLE_SCOPE_KEY = 'throttleScope';

/** Rotas com limite de requisicoes proprio, alem do limite geral. */
export enum ThrottleScope {
  Login = 'login',
  Register = 'register',
}

/**
 * Aplica o limite extra do escopo (THROTTLE_AUTH_LOGIN_LIMIT ou
 * THROTTLE_AUTH_REGISTER_LIMIT) a rota. Ver `config/throttle/throttler.config.ts`.
 */
export const RateLimitScope = (scope: ThrottleScope) => SetMetadata(THROTTLE_SCOPE_KEY, scope);
