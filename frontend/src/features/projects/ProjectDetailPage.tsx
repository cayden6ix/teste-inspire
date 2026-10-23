import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField, Input, Textarea } from '@/components/ui/Field';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PROJECT_ROLE_LABELS } from '@/types/project';
import { useConfirm } from '@/stores/confirmStore';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';
import { motionMs } from '@/utils/motion';
import { notifyError } from '@/utils/notify';
import { ROLE_TONES } from '@/utils/tone';
import { deleteProject, updateProject } from './projects.service';
import { ProjectUnavailable } from './ProjectUnavailable';
import { useProject } from './useProject';

/**
 * Detalhe do projeto: contexto das tarefas (D-011) e atalhos para as
 * demais telas do projeto.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { project, loading, error, retryable, reload } = useProject(projectId);
  const [editing, setEditing] = useState(false);
  /** O card Editar toca o fade de saida antes de ser desmontado. */
  const [editClosing, setEditClosing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  useDocumentTitle(project?.name ?? 'Projeto');

  function closeEditor() {
    setEditClosing(true);
  }

  // Rede de seguranca: se `animationend` nao disparar, o card nao fica preso na tela.
  useEffect(() => {
    if (!editClosing) return;
    const timer = window.setTimeout(() => {
      setEditing(false);
      setEditClosing(false);
    }, motionMs('slow') + 100);
    return () => window.clearTimeout(timer);
  }, [editClosing]);

  const canEdit = project?.role === 'owner' || project?.role === 'admin';
  const canDelete = project?.role === 'owner';

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!project) return;

    setFormError(null);
    setSaving(true);

    try {
      await updateProject(project.id, { name, description: description || null });
      closeEditor();
      toast.success('Projeto atualizado.');
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Não foi possível salvar o projeto.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;

    setFormError(null);

    try {
      const deleted = await confirm({
        title: 'Excluir projeto?',
        description: `Esta ação não pode ser desfeita. O projeto "${project.name}" e todas as suas tarefas serão excluídos.`,
        confirmLabel: 'Excluir',
        loadingLabel: 'Excluindo…',
        action: () => deleteProject(project.id),
      });
      if (!deleted) return;

      toast.success('Projeto excluído.');
      navigate('/projects');
    } catch (err) {
      notifyError(err, 'Não foi possível excluir o projeto.');
    }
  }

  // Esqueleto enquanto carrega; erro de rede/5xx com "Tentar novamente"; 400/403/404 com
  // "Voltar para projetos" (repetir nao resolve, PRJ-19).
  if (!project) {
    return (
      <ProjectUnavailable
        error={error}
        retryable={retryable}
        retrying={loading}
        onRetry={() => void reload()}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        title={
          <>
            {project.name}
            <Badge tone={ROLE_TONES[project.role]}>{PROJECT_ROLE_LABELS[project.role]}</Badge>
          </>
        }
        description={project.description}
        actions={
          <>
            {canEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setName(project.name);
                  setDescription(project.description ?? '');
                  setFormError(null);
                  if (editing) {
                    closeEditor();
                  } else {
                    setEditClosing(false);
                    setEditing(true);
                  }
                }}
              >
                {editing ? 'Cancelar' : 'Editar'}
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => void handleDelete()}>
                Excluir
              </Button>
            )}
          </>
        }
      />

      {formError && <Alert>{formError}</Alert>}

      {editing && (
        <Card
          title="Editar projeto"
          className={editClosing ? 'animate-fade-out' : 'animate-slide-up'}
          onAnimationEnd={(event) => {
            if (editClosing && event.target === event.currentTarget) {
              setEditing(false);
              setEditClosing(false);
            }
          }}
        >
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <FormField label="Nome" htmlFor="edit-name">
              <Input
                id="edit-name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do projeto"
              />
            </FormField>
            <FormField label="Descrição" htmlFor="edit-description">
              <Textarea
                id="edit-description"
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormField>
            <div>
              <Button type="submit" loading={saving} loadingLabel="Salvando…">
                Salvar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Card title="Tarefas" description="Cada tarefa pertence a este projeto e só existe dentro dele.">
          <ButtonLink to={`/projects/${project.id}/tasks`} className="mt-auto self-start">
            Ver tarefas
          </ButtonLink>
        </Card>
        <Card title="Quadro" description="Quadro por status, com arrastar e soltar.">
          <ButtonLink to={`/projects/${project.id}/board`} className="mt-auto self-start">
            Ver quadro
          </ButtonLink>
        </Card>
        <Card title="Membros" description="Papéis: proprietário, administrador, membro e visualizador.">
          <ButtonLink to={`/projects/${project.id}/members`} className="mt-auto self-start">
            Ver membros
          </ButtonLink>
        </Card>
        <Card title="Relatórios" description="Totais por status ou por responsável.">
          <ButtonLink to={`/reports?projectId=${project.id}`} className="mt-auto self-start">
            Ver relatório
          </ButtonLink>
        </Card>
        <Card title="CSV" description="Exporta e importa tarefas em massa.">
          <ButtonLink to={`/projects/${project.id}/tasks`} className="mt-auto self-start">
            Exportar / importar
          </ButtonLink>
        </Card>
      </div>
    </Page>
  );
}
