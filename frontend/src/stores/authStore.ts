import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  setAccessToken: (accessToken: string | null) => void;
  logout: () => void;
}

/**
 * Estado global de sessao.
 *
 * O access token e persistido em localStorage para que a sessao sobreviva a
 * recarregamento da pagina (a API e stateless - o token e a unica credencial).
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      logout: () => set({ accessToken: null }),
    }),
    { name: 'auth-store' },
  ),
);
