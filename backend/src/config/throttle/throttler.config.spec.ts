import type { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RateLimitScope,
  ThrottleScope,
} from '../../common/decorators/throttle-scope.decorator.js';
import { STATUS_MESSAGES } from '../../common/messages/http-messages.js';
import { buildThrottlerOptions } from './throttler.config.js';

class RotasDeExemplo {
  @RateLimitScope(ThrottleScope.Login)
  entrar() {}

  @RateLimitScope(ThrottleScope.Register)
  cadastrar() {}

  qualquer() {}
}

const contexto = (metodo: keyof RotasDeExemplo) =>
  ({
    getHandler: () => RotasDeExemplo.prototype[metodo],
    getClass: () => RotasDeExemplo,
  }) as unknown as ExecutionContext;

const configurar = (valores: Record<string, unknown> = {}) =>
  buildThrottlerOptions({
    get: (chave: string, padrao?: unknown) => valores[chave] ?? padrao,
  } as unknown as ConfigService);

type Limitador = {
  name?: string;
  ttl: unknown;
  limit: unknown;
  skipIf?: (context: ExecutionContext) => boolean;
};

const limitadores = (opcoes: ReturnType<typeof configurar>) =>
  (Array.isArray(opcoes) ? opcoes : opcoes.throttlers) as Limitador[];

const porNome = (opcoes: ReturnType<typeof configurar>, nome: string) =>
  limitadores(opcoes).find((limitador) => limitador.name === nome)!;

describe('buildThrottlerOptions (R09)', () => {
  it('usa os padrões: 100 por minuto no geral, 10 no login e 5 no cadastro', () => {
    const opcoes = configurar();

    expect(limitadores(opcoes).map((l) => [l.name, l.limit, l.ttl])).toEqual([
      ['default', 100, 60_000],
      ['auth-login', 10, 60_000],
      ['auth-register', 5, 60_000],
    ]);
  });

  it('lê os limites e a janela do ambiente', () => {
    const opcoes = configurar({
      THROTTLE_TTL_SECONDS: 30,
      THROTTLE_LIMIT: 50,
      THROTTLE_AUTH_LOGIN_LIMIT: 3,
      THROTTLE_AUTH_REGISTER_LIMIT: 2,
    });

    expect(limitadores(opcoes).map((l) => [l.name, l.limit, l.ttl])).toEqual([
      ['default', 50, 30_000],
      ['auth-login', 3, 30_000],
      ['auth-register', 2, 30_000],
    ]);
  });

  it('a mensagem do 429 é a do filtro de erros, em português', () => {
    expect(configurar()).toMatchObject({ errorMessage: STATUS_MESSAGES[429] });
  });

  it('o limite de login só vale nas rotas marcadas com @RateLimitScope(Login)', () => {
    const login = porNome(configurar(), 'auth-login');

    expect(login.skipIf?.(contexto('entrar'))).toBe(false);
    expect(login.skipIf?.(contexto('cadastrar'))).toBe(true);
    expect(login.skipIf?.(contexto('qualquer'))).toBe(true);
  });

  it('o limite de cadastro só vale nas rotas marcadas com @RateLimitScope(Register)', () => {
    const cadastro = porNome(configurar(), 'auth-register');

    expect(cadastro.skipIf?.(contexto('cadastrar'))).toBe(false);
    expect(cadastro.skipIf?.(contexto('entrar'))).toBe(true);
    expect(cadastro.skipIf?.(contexto('qualquer'))).toBe(true);
  });

  it('THROTTLE_DISABLED=true desliga todos os limitadores', () => {
    const opcoes = configurar({ THROTTLE_DISABLED: true });

    for (const limitador of limitadores(opcoes)) {
      expect(limitador.skipIf?.(contexto('entrar')), limitador.name).toBe(true);
      expect(limitador.skipIf?.(contexto('qualquer')), limitador.name).toBe(
        true,
      );
    }
  });

  it('o limitador geral vale para qualquer rota quando o rate limit está ligado', () => {
    const geral = porNome(configurar(), 'default');

    expect(geral.skipIf?.(contexto('qualquer'))).toBe(false);
  });
});
