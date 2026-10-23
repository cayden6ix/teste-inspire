import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from './authStore';

/** JWT minimo com `sub` (so o payload e lido). */
function tokenDe(sub: string): string {
  return `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;
}

const estado = () => useAuthStore.getState();

describe('authStore: Sair x sessão expirada (AUT-24)', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, expiredUserId: null, signedOut: false });
  });

  it('entrar grava o token e zera o "saiu"', () => {
    useAuthStore.setState({ signedOut: true });

    estado().setAccessToken(tokenDe('ana'));

    expect(estado()).toMatchObject({ accessToken: tokenDe('ana'), signedOut: false });
  });

  it('Sair limpa a sessão, marca a saída voluntária e esquece quem era', () => {
    estado().setAccessToken(tokenDe('ana'));
    useAuthStore.setState({ expiredUserId: 'antigo' });

    estado().logout();

    expect(estado()).toMatchObject({ accessToken: null, signedOut: true, expiredUserId: null });
  });

  it('sessão expirada (401) lembra o id do usuário para o redirect-back', () => {
    estado().setAccessToken(tokenDe('ana'));

    estado().expire();

    expect(estado()).toMatchObject({ accessToken: null, signedOut: false, expiredUserId: 'ana' });
  });
});
