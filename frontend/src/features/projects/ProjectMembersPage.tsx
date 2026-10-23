import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { DataColumn } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClearFilters, FilterSelect, ResultCount, Toolbar } from '@/components/ui/Toolbar';
import { PROJECT_ROLE_LABELS, PROJECT_ROLES, assignableRoles, canManageMember, canManageMembers } from '@/types/project';
import type { ProjectMember, ProjectRole } from '@/types/project';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useRowStates } from '@/hooks/useRowStates';
import { useConfirm } from '@/stores/confirmStore';
import { useToast } from '@/stores/toastStore';
import { notifyError } from '@/utils/notify';
import { delay, motionMs } from '@/utils/motion';
import { ROLE_TONES } from '@/utils/tone';
import { DEFAULT_PAGE_LIMIT } from '@/types/pagination';
import { AddMemberModal } from './AddMemberModal';
import { ProjectUnavailable } from './ProjectUnavailable';
import { removeMember, updateMemberRole } from './projects.service';
import { useMembers } from './useMembers';
import { useProject } from './useProject';

/**
 * Membros do projeto e seus papeis (D-013).
 */
export function ProjectMembersPage() {
  const { projectId } = useParams();
  const projectState = useProject(projectId);
  const { project } = projectState;
  const [roleFilter, setRoleFilter] = useState<ProjectRole | ''>('');
  const {
    data: members,
    meta,
    setPage,
    loading,
    error,
    reload,
  } = useMembers(projectId, DEFAULT_PAGE_LIMIT, roleFilter || undefined);
  const [adding, setAdding] = useState(false);
  const rowStates = useRowStates();
  /** Papel escolhido no select da linha enquanto o PATCH roda. */
  const [pendingRole, setPendingRole] = useState<Record<string, ProjectRole>>({});
  const toast = useToast();
  const confirm = useConfirm();

  const currentUserId = useCurrentUserId();

  useDocumentTitle(project ? `Membros — ${project.name}` : 'Membros');

  /** "Tentar novamente" recarrega o projeto (e o papel, que decide o que pode ser editado) e os membros. */
  function retryAll() {
    void projectState.reload();
    void reload();
  }

  /** Papéis que o ator pode atribuir e se pode gerenciar membros (owner e admin). */
  const roles = assignableRoles(project?.role);
  const canManage = canManageMembers(project?.role);
  /** Por linha: o select e o Remover só existem quando as regras do backend permitem. */
  const canEditRow = (member: ProjectMember) => canManageMember(project?.role, currentUserId, member);

  /** O modal fecha sozinho depois da animacao de saida; aqui so recarrega a lista. */
  async function handleAdded() {
    await reload();
  }

  async function handleRoleChange(memberUserId: string, nextRole: ProjectRole) {
    if (!projectId) return;

    rowStates.set(memberUserId, 'saving');
    setPendingRole((prev) => ({ ...prev, [memberUserId]: nextRole }));

    try {
      await updateMemberRole(projectId, memberUserId, nextRole);
      toast.success('Papel atualizado.');
      await reload();
    } catch (err) {
      notifyError(err, 'Não foi possível alterar o papel.');
    } finally {
      rowStates.clear(memberUserId);
      setPendingRole((prev) => {
        const next = { ...prev };
        delete next[memberUserId];
        return next;
      });
    }
  }

  async function handleRemove(memberUserId: string, memberName: string) {
    if (!projectId) return;

    try {
      const removed = await confirm({
        title: 'Remover membro?',
        description: `${memberName} perderá o acesso ao projeto e as tarefas atribuídas a essa pessoa ficarão sem responsável.`,
        confirmLabel: 'Remover',
        loadingLabel: 'Removendo…',
        action: () => removeMember(projectId, memberUserId),
      });
      if (!removed) return;

      rowStates.set(memberUserId, 'removing');
      toast.success('Membro removido.');
      await delay(motionMs('fast'));
      await reload();
    } catch (err) {
      notifyError(err, 'Não foi possível remover o membro.');
    } finally {
      rowStates.clear(memberUserId);
    }
  }

  const columns: DataColumn<ProjectMember>[] = [
    {
      key: 'name',
      header: 'Nome',
      primary: true,
      mobileLabel: false,
      render: (member) => (
        <span className="block truncate font-medium text-slate-900">{member.name}</span>
      ),
    },
    {
      key: 'email',
      header: 'E-mail',
      width: 'md:w-1/3',
      mobileLabel: false,
      render: (member) => <span className="block truncate text-slate-600">{member.email}</span>,
    },
    {
      key: 'role',
      header: 'Papel',
      width: 'md:w-56',
      mobileLabel: false,
      render: (member) =>
        canEditRow(member) ? (
          <Select
            value={pendingRole[member.userId] ?? member.role}
            onChange={(e) => void handleRoleChange(member.userId, e.target.value as ProjectRole)}
            aria-label={`Papel de ${member.name}`}
            saving={rowStates.get(member.userId) === 'saving'}
          >
            {roles.map((option) => (
              <option key={option} value={option}>
                {PROJECT_ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
        ) : (
          <Badge tone={ROLE_TONES[member.role]}>{PROJECT_ROLE_LABELS[member.role]}</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      width: 'md:w-32',
      align: 'right',
      mobileLabel: false,
      render: (member) =>
        canEditRow(member) ? (
          <Button variant="danger" onClick={() => void handleRemove(member.userId, member.name)}>
            Remover
          </Button>
        ) : null,
    },
  ];

  // Sem o projeto, o papel do usuario e desconhecido e a tela pareceria somente leitura.
  if (!project) {
    return (
      <ProjectUnavailable
        error={projectState.error}
        retryable={projectState.retryable}
        retrying={projectState.loading}
        onRetry={retryAll}
      />
    );
  }

  return (
    <Page>
      <PageHeader
        title="Membros"
        description={`Projeto ${project.name}. Papéis: proprietário, administrador, membro e visualizador.`}
        actions={canManage && <Button onClick={() => setAdding(true)}>Adicionar membro</Button>}
      />

      <Toolbar>
        <FilterSelect
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value as ProjectRole | '');
            setPage(1);
          }}
          aria-label="Filtrar por papel"
        >
          <option value="">Todos os papéis</option>
          {PROJECT_ROLES.map((option) => (
            <option key={option} value={option}>
              {PROJECT_ROLE_LABELS[option]}
            </option>
          ))}
        </FilterSelect>
        <ClearFilters
          active={roleFilter !== ''}
          onClick={() => {
            setRoleFilter('');
            setPage(1);
          }}
        />
        <ResultCount count={meta.total} loading={loading} />
      </Toolbar>

      <DataTable
        label="Membros do projeto"
        columns={columns}
        rows={members}
        rowKey={(member) => member.id}
        loading={loading}
        error={error}
        onRetry={retryAll}
        rowState={(member) => rowStates.get(member.userId)}
        loadingLabel="Carregando membros…"
        emptyTitle="Nenhum membro encontrado."
        emptyDescription={roleFilter ? 'Nenhum membro com esse papel.' : undefined}
        pagination={{ meta, onPageChange: setPage }}
      />

      {adding && canManage && projectId && (
        <AddMemberModal
          projectId={projectId}
          roles={roles}
          onClose={() => setAdding(false)}
          onAdded={handleAdded}
        />
      )}
    </Page>
  );
}
