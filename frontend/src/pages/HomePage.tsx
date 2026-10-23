import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useAuthStore } from '@/stores/authStore';

export function HomePage() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useDocumentTitle('Início');

  return (
    <Page>
      <PageHeader
        title="API de Gestão de Projetos e Tarefas"
        description="Organize o trabalho por projetos: cada tarefa pertence a um projeto, o acesso é controlado por papéis e os relatórios agregam o andamento por status ou responsável."
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {accessToken ? (
          <>
            <Card title="Projetos" description="Todo projeto tem membros com papéis e tarefas no seu contexto." className="h-full">
              <ButtonLink to="/projects" variant="primary" className="mt-auto self-start">
                Ver projetos
              </ButtonLink>
            </Card>
            <Card title="Quadro" description="Kanban por status, com arrastar e soltar." className="h-full">
              <ButtonLink to="/projects" className="mt-auto self-start">
                Escolher projeto
              </ButtonLink>
            </Card>
            <Card title="Relatórios" description="Totais de tarefas por status ou por responsável." className="h-full">
              <ButtonLink to="/reports" className="mt-auto self-start">
                Ver relatórios
              </ButtonLink>
            </Card>
          </>
        ) : (
          <>
            <Card title="Entrar" description="Entre para gerenciar seus projetos." className="h-full">
              <ButtonLink to="/login" variant="primary" className="mt-auto self-start">
                Entrar
              </ButtonLink>
            </Card>
            <Card title="Cadastrar" description="Crie sua conta para criar projetos e convidar membros." className="h-full">
              <ButtonLink to="/register" className="mt-auto self-start">
                Cadastrar
              </ButtonLink>
            </Card>
            <Card
              title="Papéis e relatórios"
              description="Papéis de proprietário, administrador, membro e visualizador controlam o acesso; os relatórios agregam o andamento."
              className="h-full"
            />
          </>
        )}
      </div>
    </Page>
  );
}
