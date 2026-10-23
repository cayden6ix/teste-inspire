import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ActivityBar } from '@/components/ui/ActivityBar';
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog';
import { ToastProvider } from '@/components/ui/Toast';
import { router } from '@/routes';
import { registerSessionExpiredHandler } from '@/services/api/httpClient';

/**
 * Raiz da aplicacao. Toasts, barra de atividade e o dialogo de confirmacao ficam fora do
 * roteador: sobrevivem a troca de layout (ex.: sair e voltar ao login) e a qualquer navegacao.
 * O dialogo vem depois das rotas, entao fica por cima de um modal aberto pela pagina.
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
      <ConfirmDialogHost />
    </ToastProvider>
  );
}
