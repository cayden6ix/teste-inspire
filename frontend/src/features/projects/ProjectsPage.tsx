import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { DataColumn } from '@/components/ui/DataTable';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClearFilters, ResultCount, SearchBox, Toolbar } from '@/components/ui/Toolbar';
import { DEFAULT_PAGE_LIMIT } from '@/types/pagination';
import { PROJECT_ROLE_LABELS } from '@/types/project';
import type { Project } from '@/types/project';
import { ROLE_TONES } from '@/utils/tone';
import { NewProjectModal } from './NewProjectModal';
import { useProjects } from './useProjects';

const COLUMNS: DataColumn<Project>[] = [
  {
    key: 'name',
    header: 'Projeto',
    primary: true,
    mobileLabel: false,
    render: (project) => (
      <div className="min-w-0">
        <Link
          to={`/projects/${project.id}`}
          className="block truncate font-medium text-slate-900 hover:underline"
        >
          {project.name}
        </Link>
        {project.description && (
          <p className="truncate text-caption text-slate-600">{project.description}</p>
        )}
      </div>
    ),
  },
  {
    key: 'role',
    header: 'Papel',
    width: 'md:w-40',
    render: (project) => <Badge tone={ROLE_TONES[project.role]}>{PROJECT_ROLE_LABELS[project.role]}</Badge>,
  },
  {
    key: 'actions',
    header: 'Ações',
    width: 'md:w-32',
    align: 'right',
    mobileLabel: false,
    render: (project) => (
      <ButtonLink to={`/projects/${project.id}`}>Abrir</ButtonLink>
    ),
  },
];

/**
 * Lista de projetos do usuario e criacao de projeto (D-011).
 */
export function ProjectsPage() {
  /** Texto digitado no campo. So vira `search` (valor aplicado) ao apertar Enter. */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const {
    data: projects,
    meta,
    setPage,
    loading,
    error,
    reload,
  } = useProjects(DEFAULT_PAGE_LIMIT, search || undefined);

  function applySearch(term: string) {
    setSearch(term.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchInput('');
    applySearch('');
  }

  /** O modal fecha sozinho depois da animacao de saida; aqui so recarrega a lista. */
  async function handleCreated() {
    await reload();
  }

  return (
    <Page>
      <PageHeader
        title="Projetos"
        description="Todo projeto tem membros com papéis e tarefas no seu contexto."
        actions={<Button onClick={() => setCreating(true)}>Novo projeto</Button>}
      />

      <Toolbar>
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={applySearch}
          applied={search}
          onClear={clearSearch}
          label="Buscar por nome ou descrição"
          placeholder="Buscar por nome ou descrição"
        />
        <ClearFilters active={search !== ''} onClick={clearSearch} />
        <ResultCount count={meta.total} loading={loading} />
      </Toolbar>

      <DataTable
        label="Meus projetos"
        columns={COLUMNS}
        rows={projects}
        rowKey={(project) => project.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        loadingLabel="Carregando projetos…"
        emptyTitle={
          search ? `Nenhum projeto encontrado para "${search}"` : 'Você ainda não participa de nenhum projeto.'
        }
        emptyDescription={search ? undefined : 'Crie um projeto para começar a organizar as tarefas.'}
        pagination={{ meta, onPageChange: setPage }}
      />

      {creating && (
        <NewProjectModal onClose={() => setCreating(false)} onCreated={handleCreated} />
      )}
    </Page>
  );
}
