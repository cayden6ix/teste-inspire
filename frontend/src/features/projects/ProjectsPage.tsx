import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Field';
import { PROJECT_ROLE_LABELS } from '@/types/project';
import { errorMessage } from '@/utils/errorMessage';
import { ROLE_TONES } from '@/utils/tone';
import { createProject } from './projects.service';
import { useProjects } from './useProjects';

/**
 * Lista de projetos do usuario e criacao de projeto (D-011).
 */
export function ProjectsPage() {
  const { projects, loading, error, reload } = useProjects();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      await createProject({ name, description: description || null });
      setName('');
      setDescription('');
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel criar o projeto.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Projetos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Todo projeto tem membros com papeis e tarefas no seu contexto.
        </p>
      </header>

      <Card title="Novo projeto">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="project-name">
              Nome
            </label>
            <Input
              id="project-name"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do projeto"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="project-description">
              Descricao
            </label>
            <Textarea
              id="project-description"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          {formError && <Alert>{formError}</Alert>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Criando...' : 'Criar projeto'}
          </Button>
        </form>
      </Card>

      <Card title="Meus projetos">
        {loading && <p className="text-sm text-slate-600">Carregando projetos...</p>}
        {error && <Alert>{error}</Alert>}
        {!loading && !error && projects.length === 0 && (
          <p className="text-sm text-slate-600">Voce ainda nao participa de nenhum projeto.</p>
        )}
        <ul className="divide-y divide-slate-200">
          {projects.map((project) => (
            <li key={project.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/projects/${project.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {project.name}
                  </Link>
                  <Badge tone={ROLE_TONES[project.role]}>{PROJECT_ROLE_LABELS[project.role]}</Badge>
                </div>
                {project.description && (
                  <p className="mt-1 text-sm text-slate-600">{project.description}</p>
                )}
              </div>
              <Link
                to={`/projects/${project.id}`}
                className="shrink-0 text-sm text-slate-700 hover:text-slate-900"
              >
                Abrir
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
