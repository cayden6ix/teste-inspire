import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { PROJECT_ROLE_LABELS } from '@/types/project';
import { errorMessage } from '@/utils/errorMessage';
import { ROLE_TONES } from '@/utils/tone';
import { deleteProject, updateProject } from './projects.service';
import { useProject } from './useProject';

/**
 * Detalhe do projeto: contexto das tarefas (D-011) e atalhos para as
 * demais telas do projeto.
 */
export function ProjectDetailPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { project, loading, error, reload } = useProject(projectId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = project?.role === 'owner' || project?.role === 'admin';
  const canDelete = project?.role === 'owner';

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!project) return;

    setFormError(null);
    setSaving(true);

    try {
      await updateProject(project.id, { name, description: description || null });
      setEditing(false);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel salvar o projeto.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!project) return;
    if (!window.confirm(`Excluir o projeto "${project.name}" e todas as suas tarefas?`)) {
      return;
    }

    setFormError(null);

    try {
      await deleteProject(project.id);
      navigate('/projects');
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel excluir o projeto.'));
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Carregando projeto...</p>;
  }

  if (error || !project) {
    return <Alert>{error ?? 'Projeto nao encontrado.'}</Alert>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{project.name}</h1>
            <Badge tone={ROLE_TONES[project.role]}>{PROJECT_ROLE_LABELS[project.role]}</Badge>
          </div>
          {project.description && <p className="mt-1 text-sm text-slate-600">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button
              variant="secondary"
              onClick={() => {
                setName(project.name);
                setDescription(project.description ?? '');
                setFormError(null);
                setEditing((v) => !v);
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
        </div>
      </header>

      {formError && <Alert>{formError}</Alert>}

      {editing && (
        <Card title="Editar projeto">
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-700" htmlFor="edit-name">
                Nome
              </label>
              <Input
                id="edit-name"
                required
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do projeto"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700" htmlFor="edit-description">
                Descricao
              </label>
              <Textarea
                id="edit-description"
                rows={2}
                maxLength={2000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </form>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Tarefas" description="Somente existem dentro do projeto (D-011).">
          <Link to={`/projects/${project.id}/tasks`} className="text-sm text-slate-900 underline">
            Ver tarefas
          </Link>
        </Card>
        <Card title="Quadro" description="Kanban por status, com arrastar e soltar (D-012).">
          <Link to={`/projects/${project.id}/board`} className="text-sm text-slate-900 underline">
            Ver quadro
          </Link>
        </Card>
        <Card title="Membros" description="Papeis owner, admin, member e viewer (D-013).">
          <Link to={`/projects/${project.id}/members`} className="text-sm text-slate-900 underline">
            Ver membros
          </Link>
        </Card>
        <Card title="Relatorios" description="Totais por status ou por responsavel (D-015).">
          <Link to={`/reports?projectId=${project.id}`} className="text-sm text-slate-900 underline">
            Ver relatorio
          </Link>
        </Card>
        <Card title="CSV" description="Exporta e importa tarefas em massa (D-014).">
          <Link to={`/projects/${project.id}/tasks`} className="text-sm text-slate-900 underline">
            Exportar / importar
          </Link>
        </Card>
      </div>
    </div>
  );
}
