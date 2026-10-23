import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { useAuthStore } from '@/stores/authStore';
import { SessionLoading } from './SessionLoading';

/**
 * Rotas protegidas: projetos, tarefas, membros e relatorios exigem sessao.
 * Enquanto a sessao persistida e restaurada mostra a tela de carregamento (em vez de mandar
 * para o login e voltar).
 *
 * Sem sessao: depois de clicar em Sair vai para a home (sem guardar a rota, AUT-24); nos demais
 * casos (link direto sem login) vai para o login guardando a rota de origem em `from`.
 */
export function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const signedOut = useAuthStore((s) => s.signedOut);
  const hydrated = useAuthHydrated();
  const location = useLocation();

  if (!hydrated) {
    return <SessionLoading />;
  }

  if (!accessToken) {
    if (signedOut) {
      return <Navigate to="/" replace />;
    }

    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
