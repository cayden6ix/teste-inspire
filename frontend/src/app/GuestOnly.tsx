import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { postLoginPath } from '@/features/auth/redirect';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { useAuthStore } from '@/stores/authStore';
import { userIdFromToken } from '@/utils/jwt';
import { SessionLoading } from './SessionLoading';

/**
 * Login e cadastro sao so para quem nao tem sessao (AUT-27). Com sessao, redireciona: quem
 * acabou de entrar vai para a rota de origem (`from`) quando ela vale para este usuario
 * (`postLoginPath`); quem ja estava logado e abriu /login ou /register vai para a home.
 *
 * E o unico lugar que decide o destino depois de entrar: as telas de login e cadastro so
 * gravam o token.
 */
export function GuestOnly() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const expiredUserId = useAuthStore((s) => s.expiredUserId);
  const hydrated = useAuthHydrated();
  const location = useLocation();

  if (!hydrated) {
    return <SessionLoading />;
  }

  if (accessToken) {
    const from = (location.state as { from?: unknown } | null)?.from;
    return <Navigate to={postLoginPath(from, expiredUserId, userIdFromToken(accessToken))} replace />;
  }

  return <Outlet />;
}
