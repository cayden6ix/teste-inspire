import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/**
 * Layout raiz da aplicacao: cabecalho + area de conteudo das rotas aninhadas.
 */
export function AppLayout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-lg font-semibold">
            Gestao de Projetos e Tarefas
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {accessToken ? (
              <button onClick={logout} className="text-slate-700 hover:text-slate-900">
                Sair
              </button>
            ) : (
              <>
                <Link to="/login" className="text-slate-700 hover:text-slate-900">
                  Entrar
                </Link>
                <Link to="/register" className="text-slate-700 hover:text-slate-900">
                  Cadastrar
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
