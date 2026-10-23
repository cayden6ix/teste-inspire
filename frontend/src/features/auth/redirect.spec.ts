import { describe, expect, it } from 'vitest';
import { postLoginPath } from './redirect';

describe('postLoginPath (AUT-24)', () => {
  it('sem rota de origem (cadastro ou depois de Sair) vai para a home', () => {
    expect(postLoginPath(undefined, null, 'ana')).toBe('/');
    expect(postLoginPath(null, null, 'ana')).toBe('/');
  });

  it('link direto sem sessão anterior volta para a rota pedida', () => {
    expect(postLoginPath('/projects/1/tasks', null, 'ana')).toBe('/projects/1/tasks');
    expect(postLoginPath('/reports?projectId=1', null, 'ana')).toBe('/reports?projectId=1');
  });

  it('sessão expirada: o MESMO usuário volta para a rota de origem', () => {
    expect(postLoginPath('/projects/1/members', 'ana', 'ana')).toBe('/projects/1/members');
  });

  it('sessão expirada: OUTRO usuário cai na home, sem herdar a rota de quem saiu', () => {
    expect(postLoginPath('/projects/1/members', 'ana', 'bruno')).toBe('/');
    expect(postLoginPath('/projects/1/members', 'ana', null)).toBe('/');
  });

  it.each(['//evil.com', 'https://evil.com', 'projects', '/login', '/register', '/login?x=1', 42])(
    'ignora destino que não é rota interna válida: %j',
    (from) => {
      expect(postLoginPath(from, null, 'ana')).toBe('/');
    },
  );
});
