import { describe, expect, it } from 'vitest';
import { userIdFromToken } from './jwt';

/** JWT com o payload informado (a assinatura nao importa: so o payload e lido). */
function tokenCom(payload: unknown): string {
  const base64url = (texto: string) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(texto)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  return `${base64url('{"alg":"HS256","typ":"JWT"}')}.${base64url(JSON.stringify(payload))}.assinatura`;
}

describe('userIdFromToken', () => {
  it('devolve o sub do payload', () => {
    expect(userIdFromToken(tokenCom({ sub: 'user-123', email: 'ana@empresa.com' }))).toBe('user-123');
  });

  it('lê payload em base64url com caracteres que viram - e _', () => {
    // "ção" e "??>" geram + e / no base64 comum: o decodificador precisa trocar - e _.
    const token = tokenCom({ sub: 'abc', nome: 'Integração ??> ~~~' });

    expect(token.split('.')[1]).toMatch(/[-_]/);
    expect(userIdFromToken(token)).toBe('abc');
  });

  it.each([
    ['nulo', null],
    ['vazio', ''],
    ['sem payload', 'abc'],
    ['payload que não é JSON', 'a.bm9vcA.c'],
    ['payload que não é base64', 'a.%%%.c'],
  ])('token inválido (%s) devolve null', (_nome, token) => {
    expect(userIdFromToken(token)).toBeNull();
  });

  it('sub ausente ou que não é texto devolve null', () => {
    expect(userIdFromToken(tokenCom({ email: 'x' }))).toBeNull();
    expect(userIdFromToken(tokenCom({ sub: 42 }))).toBeNull();
  });
});
