import { useSyncExternalStore } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { SessionLoading } from './SessionLoading';

function subscribeHydration(listener: () => void) {
  return useAuthStore.persist.onFinishHydration(listener);
}

function isHydrated() {
  return useAuthStore.persist.hasHydrated();
}

/**
 * Rotas protegidas: projetos, tarefas, membros e relatorios exigem sessao.
 * Enquanto a sessao persistida e restaurada mostra a tela de carregamento (em vez de mandar
 * para o login e voltar).
 */
export function RequireAuth() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, () => false);
  const location = useLocation();

  if (!hydrated) {
    return <SessionLoading />;
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return <Outlet />;
}
