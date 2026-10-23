import { Link, Outlet } from 'react-router-dom';
import { PageTransition } from '@/components/ui/PageTransition';
import { MAIN_CONTENT_ID, SkipLink } from '@/components/ui/SkipLink';

const HIGHLIGHTS = [
  'Projetos com membros e papéis',
  'Tarefas em lista e em quadro Kanban',
  'Relatórios e importação/exportação de CSV',
];

/**
 * Layout de tela inteira de Login e Cadastro: em >= lg, painel de identidade ocupando metade
 * da largura e formulario na outra metade; abaixo disso o painel some e o formulario ocupa
 * toda a largura (com a identidade resumida no topo).
 */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen w-full animate-fade-in bg-white lg:grid-cols-2">
      <SkipLink />
      <aside className="hidden flex-col justify-between gap-8 bg-slate-900 p-8 text-white lg:flex">
        <Link to="/" className="text-heading font-semibold">
          Gestão de Projetos e Tarefas
        </Link>
        <div className="flex flex-col gap-6">
          <h2 className="text-display font-semibold">Organize o trabalho por projetos.</h2>
          <p className="max-w-prose text-heading text-slate-300">
            Cada tarefa pertence a um projeto, o acesso é controlado por papéis e os relatórios
            agregam o andamento por status ou responsável.
          </p>
          <ul className="flex flex-col gap-3 text-body text-slate-200">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span aria-hidden="true" className="size-2 rounded-pill bg-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-caption text-slate-400">API de Gestão de Projetos e Tarefas</p>
      </aside>

      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="flex min-w-0 flex-col justify-center gap-6 px-gutter py-page outline-none"
      >
        <Link to="/" className="truncate text-heading font-semibold text-slate-900 lg:hidden">
          Gestão de Projetos e Tarefas
        </Link>
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
    </div>
  );
}
