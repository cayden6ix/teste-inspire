import { Spinner } from '@/components/ui/Spinner';

/**
 * Tela de carregamento de sessao: ocupa a tela inteira no mesmo fundo do app, entao quem
 * esta autenticado nunca ve um clarao da tela de login enquanto a sessao e restaurada.
 */
export function SessionLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-slate-600">
      <Spinner size="lg" label="Verificando sessão…" />
      <p aria-hidden="true" className="text-body">
        Verificando sessão…
      </p>
    </div>
  );
}
