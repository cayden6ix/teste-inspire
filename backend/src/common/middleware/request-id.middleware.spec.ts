import type { NextFunction, Response } from 'express';
import {
  RequestIdMiddleware,
  type RequestWithId,
} from './request-id.middleware.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function executar(recebido?: string) {
  const request = {
    header: (nome: string) => (nome === 'x-request-id' ? recebido : undefined),
  } as unknown as RequestWithId;
  const setHeader = vi.fn();
  const response = { setHeader } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  new RequestIdMiddleware().use(request, response, next);

  return { request, setHeader, next };
}

describe('RequestIdMiddleware', () => {
  it('gera um UUID quando o cliente não envia x-request-id', () => {
    const { request, setHeader, next } = executar();

    expect(request.id).toMatch(UUID_V4);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', request.id);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it.each([
    '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    'frontend_req-123',
    'A'.repeat(64),
  ])('reaproveita um id em formato seguro (%s)', (id) => {
    const { request, setHeader } = executar(id);

    expect(request.id).toBe(id);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', id);
  });

  it.each([
    { nome: 'longo demais (65 caracteres)', valor: 'A'.repeat(65) },
    { nome: 'com espaços', valor: 'id com espaco' },
    { nome: 'com quebra de linha (log forging)', valor: 'abc\nERROR forjado' },
    { nome: 'com caracteres especiais', valor: '<script>alert(1)</script>' },
    { nome: 'com ponto e vírgula', valor: 'abc;def' },
    { nome: 'vazio', valor: '' },
  ])('descarta o id $nome e gera um UUID novo', ({ valor }) => {
    const { request, setHeader } = executar(valor);

    expect(request.id).toMatch(UUID_V4);
    expect(request.id).not.toBe(valor);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', request.id);
  });
});
