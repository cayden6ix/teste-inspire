import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { userIdFromToken } from '@/utils/jwt';

interface AuthState {
  accessToken: string | null;
  /**
   * Id do usuario cuja sessao EXPIROU (401). O login seguinte so volta para a rota de origem
   * se for do mesmo usuario; outro usuario cai na home.
   */
  expiredUserId: string | null;
  /** A pessoa clicou em Sair nesta aba: as rotas protegidas levam para a home, sem "voltar para". */
  signedOut: boolean;
  setAccessToken: (accessToken: string) => void;
  /** Saida voluntaria (botao Sair). */
  logout: () => void;
  /** Sessao expirada ou token recusado (401): lembra de quem era a sessao. */
  expire: () => void;
}

/**
 * Estado global de sessao.
 *
 * Apenas o access token e persistido em localStorage, para que a sessao sobreviva a
 * recarregamento da pagina (a API e stateless - o token e a unica credencial). Os demais
 * campos so orientam o redirecionamento depois de sair ou de a sessao expirar.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      expiredUserId: null,
      signedOut: false,
      setAccessToken: (accessToken) => set({ accessToken, signedOut: false }),
      logout: () => set({ accessToken: null, expiredUserId: null, signedOut: true }),
      expire: () =>
        set({ accessToken: null, expiredUserId: userIdFromToken(get().accessToken), signedOut: false }),
    }),
    { name: 'auth-store', partialize: (state) => ({ accessToken: state.accessToken }) },
  ),
);
