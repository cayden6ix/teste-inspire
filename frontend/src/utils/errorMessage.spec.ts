import { AxiosError, AxiosHeaders } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { describe, expect, it } from 'vitest';
import {
  errorList,
  errorMessage,
  errorStatus,
  isNetworkError,
  isRetryableError,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from './errorMessage';

const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

/** Erro do axios com resposta HTTP (status, corpo e cabecalhos). */
function respostaComErro(
  status: number,
  data: unknown = {},
  headers: Record<string, string> = {},
): AxiosError {
  const response = { status, statusText: '', data, headers, config } as AxiosResponse;
  return new AxiosError('falhou', String(status), config, {}, response);
}

/** Erro do axios sem resposta: rede fora do ar ou tempo esgotado. */
function semResposta(code: string): AxiosError {
  return new AxiosError('sem resposta', code, config, {});
}

describe('errorList / errorMessage', () => {
  it('usa a message da API (texto) em português', () => {
    const erro = respostaComErro(409, { message: 'Este e-mail já está cadastrado.' });

    expect(errorList(erro, 'genérica')).toEqual(['Este e-mail já está cadastrado.']);
    expect(errorMessage(erro)).toBe('Este e-mail já está cadastrado.');
  });

  it('lista de validação vira lista (e frase única em errorMessage)', () => {
    const erro = respostaComErro(400, {
      message: ['O campo "Nome" não pode estar vazio.', 'O campo "E-mail" deve ser um e-mail válido.'],
    });

    expect(errorList(erro, 'x')).toHaveLength(2);
    expect(errorMessage(erro)).toBe(
      'O campo "Nome" não pode estar vazio. O campo "E-mail" deve ser um e-mail válido.',
    );
  });

  it('401 sem message vira sessão expirada; com anonymous (login) usa o texto do chamador', () => {
    expect(errorList(respostaComErro(401), 'Falha ao entrar.')).toEqual([SESSION_EXPIRED_MESSAGE]);
    expect(errorList(respostaComErro(401), 'Falha ao entrar.', { anonymous: true })).toEqual([
      'Falha ao entrar.',
    ]);
  });

  it('403 sem message usa o texto genérico de permissão; com message, a da API', () => {
    expect(errorMessage(respostaComErro(403))).toBe('Você não tem permissão para realizar esta ação.');
    expect(
      errorMessage(respostaComErro(403, { message: 'Seu papel no projeto não permite esta ação.' })),
    ).toBe('Seu papel no projeto não permite esta ação.');
  });

  it('429 acrescenta o Retry-After em segundos (singular e plural)', () => {
    const muitos = respostaComErro(429, {}, { 'retry-after': '42' });
    const um = respostaComErro(429, { message: 'Muitas requisições.' }, { 'retry-after': '1' });

    expect(errorMessage(muitos)).toBe(
      'Muitas requisições. Aguarde alguns instantes e tente novamente. Tente novamente em 42 segundos.',
    );
    expect(errorMessage(um)).toBe('Muitas requisições. Tente novamente em 1 segundo.');
  });

  it('5xx sem message usa o texto de erro do servidor', () => {
    expect(errorMessage(respostaComErro(500))).toBe(
      'O servidor encontrou um problema. Tente novamente em instantes.',
    );
  });

  it('erro de rede e tempo esgotado têm mensagens próprias', () => {
    expect(errorMessage(semResposta('ERR_NETWORK'))).toBe(NETWORK_ERROR_MESSAGE);
    expect(errorMessage(semResposta('ECONNABORTED'))).toBe(TIMEOUT_ERROR_MESSAGE);
  });

  it('erro que não é do axios usa o fallback', () => {
    expect(errorMessage(new Error('x'), 'Algo deu errado.')).toBe('Algo deu errado.');
  });
});

describe('isNetworkError / errorStatus / isRetryableError', () => {
  it('rede e tempo esgotado são falha de rede; cancelamento não', () => {
    expect(isNetworkError(semResposta('ERR_NETWORK'))).toBe(true);
    expect(isNetworkError(semResposta('ERR_CANCELED'))).toBe(false);
    expect(isNetworkError(respostaComErro(500))).toBe(false);
  });

  it('errorStatus lê o status da resposta', () => {
    expect(errorStatus(respostaComErro(404))).toBe(404);
    expect(errorStatus(semResposta('ERR_NETWORK'))).toBeNull();
    expect(errorStatus(new Error('x'))).toBeNull();
  });

  it.each([
    ['rede', semResposta('ERR_NETWORK'), true],
    ['500', respostaComErro(500), true],
    ['503', respostaComErro(503), true],
    ['429', respostaComErro(429), true],
    ['400', respostaComErro(400), false],
    ['403', respostaComErro(403), false],
    ['404', respostaComErro(404), false],
  ])('%s: "Tentar novamente" faz sentido? %s', (_nome, erro, esperado) => {
    expect(isRetryableError(erro)).toBe(esperado);
  });
});
