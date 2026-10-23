import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ActivityBar } from '@/components/ui/ActivityBar';
import { ToastProvider } from '@/components/ui/Toast';
import { router } from '@/routes';
import { registerSessionExpiredHandler } from '@/services/api/httpClient';

/**
 * Raiz da aplicacao. Toasts e barra de atividade ficam acima do roteador: sobrevivem a
 * troca de layout (ex.: sair e voltar ao login) e a qualquer navegacao.
 */
export function App() {
  // 401 numa requisicao autenticada: o httpClient avisa e a navegacao para /login fica aqui.
  useEffect(
    () =>
      registerSessionExpiredHandler((from) => {
        if (router.state.location.pathname !== '/login') {
          void router.navigate('/login', { replace: true, state: { from } });
        }
      }),
    [],
  );

  return (
    <ToastProvider>
      <ActivityBar />
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
