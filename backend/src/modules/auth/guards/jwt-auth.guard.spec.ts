import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Public } from '../../../common/decorators/public.decorator.js';
import {
  STATUS_MESSAGES,
  TOKEN_EXPIRED_MESSAGE,
  TOKEN_INVALID_MESSAGE,
} from '../../../common/messages/http-messages.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

describe('JwtAuthGuard.handleRequest', () => {
  const guard = new JwtAuthGuard(new Reflector());
  const usuario = { id: 'user-1' };

  it('devolve o usuário quando a autenticação deu certo', () => {
    expect(guard.handleRequest(null, usuario, undefined)).toBe(usuario);
  });

  it('propaga o erro original (ex.: falha de banco) em vez de mascará-lo como 401', () => {
    const erro = new Error('banco indisponível');

    expect(() => guard.handleRequest(erro, false, undefined)).toThrow(erro);
  });

  it('token ausente devolve 401 com a mensagem genérica de autenticação', () => {
    const info = new Error('No auth token');

    expect(() => guard.handleRequest(null, false, info)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      STATUS_MESSAGES[401],
    );
    expect(() => guard.handleRequest(null, false, undefined)).toThrow(
      STATUS_MESSAGES[401],
    );
  });

  it('token inválido devolve 401 com a mensagem de token inválido', () => {
    const info = Object.assign(new Error('invalid signature'), {
      name: 'JsonWebTokenError',
    });

    expect(() => guard.handleRequest(null, false, info)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      TOKEN_INVALID_MESSAGE,
    );
  });

  it('token expirado devolve 401 com a mensagem de sessão expirada', () => {
    const info = Object.assign(new Error('jwt expired'), {
      name: 'TokenExpiredError',
    });

    expect(() => guard.handleRequest(null, false, info)).toThrow(
      UnauthorizedException,
    );
    expect(() => guard.handleRequest(null, false, info)).toThrow(
      TOKEN_EXPIRED_MESSAGE,
    );
  });
});

describe('JwtAuthGuard.canActivate', () => {
  class RotaPublica {
    @Public()
    entrar() {}
  }

  class RotaProtegida {
    sair() {}
  }

  @Public()
  class ControllerPublico {
    qualquer() {}
  }

  const contexto = (classe: new () => object, metodo: string) =>
    ({
      getHandler: () =>
        (classe.prototype as Record<string, () => void>)[metodo],
      getClass: () => classe,
    }) as unknown as ExecutionContext;

  const guard = new JwtAuthGuard(new Reflector());

  it('libera a rota marcada com @Public() sem exigir token', () => {
    expect(guard.canActivate(contexto(RotaPublica, 'entrar'))).toBe(true);
  });

  it('libera todas as rotas de um controller marcado com @Public()', () => {
    expect(guard.canActivate(contexto(ControllerPublico, 'qualquer'))).toBe(
      true,
    );
  });

  it('rota sem @Public() segue para a estratégia JWT (não é liberada)', () => {
    const delegado = vi
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype) as {
          canActivate: () => unknown;
        },
        'canActivate',
      )
      .mockReturnValue(false);

    expect(guard.canActivate(contexto(RotaProtegida, 'sair'))).toBe(false);
    expect(delegado).toHaveBeenCalledTimes(1);

    delegado.mockRestore();
  });
});
