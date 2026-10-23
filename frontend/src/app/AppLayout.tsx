import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button, buttonClass } from '@/components/ui/Button';
import { PageTransition } from '@/components/ui/PageTransition';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/ui/SkipLink';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/stores/toastStore';

/**
 * Layout raiz da aplicacao: cabecalho + area de conteudo das rotas aninhadas,
 * ambos em largura total com a margem lateral padrao (px-gutter).
 */
export function AppLayout() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const toast = useToast();

  function handleLogout() {
    logout();
    toast.success('Você saiu da sessão.');
    navigate('/');
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    buttonClass({ variant: isActive ? 'secondary' : 'ghost', className: 'max-sm:flex-1' });

  return (
    <div className="flex min-h-screen animate-fade-in flex-col bg-slate-50 text-slate-900">
      <SkipLink />
      <header className="border-b border-slate-200 bg-white">
        <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 px-gutter py-3">
          <Link to="/" className="min-w-0 truncate text-heading font-semibold transition-colors hover:text-slate-600 max-sm:w-full">
            Gestão de Projetos e Tarefas
          </Link>
          <nav className="flex items-center gap-2 max-sm:w-full">
            {accessToken ? (
              <>
                <NavLink to="/projects" className={navClass}>
                  Projetos
                </NavLink>
                <NavLink to="/reports" className={navClass}>
                  Relatórios
                </NavLink>
                <Button variant="ghost" onClick={handleLogout} className="max-sm:flex-1">
                  Sair
                </Button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={navClass}>
                  Entrar
                </NavLink>
                <NavLink to="/register" className={navClass}>
                  Cadastrar
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="w-full min-w-0 flex-1 px-gutter py-page outline-none">
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
