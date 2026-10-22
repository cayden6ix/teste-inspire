import { Link } from 'react-router-dom';

type TaskViewTabsProps = {
  projectId: string | undefined;
  active: 'lista' | 'quadro';
};

/**
 * Alternancia entre a lista e o quadro das tarefas do mesmo projeto.
 * O fluxo fica explicito: as duas visoes do mesmo contexto (D-011).
 */
export function TaskViewTabs({ projectId, active }: TaskViewTabsProps) {
  if (!projectId) {
    return null;
  }

  const tabClass = (isActive: boolean) =>
    `rounded border px-3 py-1.5 text-sm font-medium transition ${
      isActive
        ? 'border-slate-900 bg-slate-900 text-white'
        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
    }`;

  return (
    <nav className="inline-flex items-center gap-2" aria-label="Visualizacao das tarefas">
      <Link
        to={`/projects/${projectId}/tasks`}
        className={tabClass(active === 'lista')}
        aria-current={active === 'lista' ? 'page' : undefined}
      >
        Lista
      </Link>
      <Link
        to={`/projects/${projectId}/board`}
        className={tabClass(active === 'quadro')}
        aria-current={active === 'quadro' ? 'page' : undefined}
      >
        Quadro
      </Link>
    </nav>
  );
}
