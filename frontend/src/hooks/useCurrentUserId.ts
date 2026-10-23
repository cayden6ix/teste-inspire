import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { userIdFromToken } from '@/utils/jwt';

/** Id do usuário logado, ou null sem sessão. */
export function useCurrentUserId(): string | null {
  const token = useAuthStore((s) => s.accessToken);

  return useMemo(() => userIdFromToken(token), [token]);
}
