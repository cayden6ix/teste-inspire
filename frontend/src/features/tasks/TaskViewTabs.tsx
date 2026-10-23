import { ButtonLink } from '@/components/ui/Button';

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

  return (
    <nav className="inline-flex items-center gap-3" aria-label="Visualização das tarefas">
      <ButtonLink
        to={`/projects/${projectId}/tasks`}
        variant={active === 'lista' ? 'primary' : 'secondary'}
        aria-current={active === 'lista' ? 'page' : undefined}
      >
        Lista
      </ButtonLink>
      <ButtonLink
        to={`/projects/${projectId}/board`}
        variant={active === 'quadro' ? 'primary' : 'secondary'}
        aria-current={active === 'quadro' ? 'page' : undefined}
      >
        Quadro
      </ButtonLink>
    </nav>
  );
}
