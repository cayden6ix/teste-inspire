import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import type { DataColumn } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { ClearFilters, FilterSelect, ResultCount, SearchBox, Toolbar } from '@/components/ui/Toolbar';
import { MAX_PAGE_LIMIT } from '@/types/pagination';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { ImportResult, Task, TaskStatus } from '@/types/task';
import { useRowStates } from '@/hooks/useRowStates';
import { useToast } from '@/stores/toastStore';
import { delay, motionMs } from '@/utils/motion';
import { formatDate } from '@/utils/format';
import { notifyError } from '@/utils/notify';
import { STATUS_TONES } from '@/utils/tone';
import { useMembers } from '@/features/projects/useMembers';
import { useProject } from '@/features/projects/useProject';
import { deleteTask, exportTasksCsv, updateTask } from './tasks.service';
import { ImportTasksModal } from './ImportTasksModal';
import { NewTaskModal } from './NewTaskModal';
import { TaskViewTabs } from './TaskViewTabs';
import { useTasks } from './useTasks';

/**
 * Tarefas do projeto (D-011, D-012) com exportacao e importacao em CSV (D-014).
 */
export function TasksPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const { data: members } = useMembers(projectId, MAX_PAGE_LIMIT);
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  /** Texto digitado no campo. So vira `search` (valor aplicado) ao apertar Enter. */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { data: tasks, meta, setPage, loading, error, reload } = useTasks(projectId, {
    search: search || undefined,
    status: status || undefined,
    assigneeId: assigneeId || undefined,
  });

  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const rowStates = useRowStates();
  /** Valor escolhido no select da linha enquanto o PATCH roda (evita o select "voltar" antes de salvar). */
  const [pendingStatus, setPendingStatus] = useState<Record<string, TaskStatus>>({});
  const toast = useToast();

  const canWrite = project !== null && project.role !== 'viewer';
  const hasFilters = search !== '' || status !== '' || assigneeId !== '';

  function applySearch(term: string) {
    setSearch(term.trim());
    setPage(1);
  }

  function clearSearch() {
    setSearchInput('');
    applySearch('');
  }

  function clearFilters() {
    setSearchInput('');
    setSearch('');
    setStatus('');
    setAssigneeId('');
    setPage(1);
  }

  /** O modal fecha sozinho depois da animacao de saida; aqui so recarrega a lista. */
  async function handleCreated() {
    await reload();
  }

  async function handleImported(_result: ImportResult) {
    await reload();
  }

  async function handleStatusChange(taskId: string, nextStatus: TaskStatus) {
    if (!projectId) return;

    rowStates.set(taskId, 'saving');
    setPendingStatus((prev) => ({ ...prev, [taskId]: nextStatus }));

    try {
      await updateTask(projectId, taskId, { status: nextStatus });
      toast.success('Status atualizado.');
      await reload();
    } catch (err) {
      notifyError(err, 'Não foi possível alterar o status da tarefa.');
    } finally {
      rowStates.clear(taskId);
      setPendingStatus((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  async function handleDelete(taskId: string, taskTitle: string) {
    if (!projectId) return;
    if (!window.confirm(`Excluir a tarefa "${taskTitle}"?`)) {
      return;
    }

    rowStates.set(taskId, 'deleting');

    try {
      await deleteTask(projectId, taskId);
      rowStates.set(taskId, 'removing');
      toast.success('Tarefa excluída.');
      await delay(motionMs('fast'));
      await reload();
    } catch (err) {
      notifyError(err, 'Não foi possível excluir a tarefa.');
    } finally {
      rowStates.clear(taskId);
    }
  }

  async function handleExport() {
    if (!projectId) return;

    setCsvBusy(true);

    try {
      const csv = await exportTasksCsv(projectId);
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `tarefas-${projectId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV exportado.');
    } catch (err) {
      notifyError(err, 'Não foi possível exportar o CSV.');
    } finally {
      setCsvBusy(false);
    }
  }

  const columns: DataColumn<Task>[] = [
    {
      key: 'title',
      header: 'Tarefa',
      primary: true,
      mobileLabel: false,
      render: (task) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{task.title}</p>
          {task.description && <p className="truncate text-caption text-slate-600">{task.description}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 'md:w-56',
      mobileLabel: false,
      render: (task) =>
        canWrite ? (
          <Select
            value={pendingStatus[task.id] ?? task.status}
            onChange={(e) => void handleStatusChange(task.id, e.target.value as TaskStatus)}
            aria-label={`Status de ${task.title}`}
            saving={rowStates.get(task.id) === 'saving'}
          >
            {TASK_STATUSES.map((option) => (
              <option key={option} value={option}>
                {TASK_STATUS_LABELS[option]}
              </option>
            ))}
          </Select>
        ) : (
          <Badge tone={STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
        ),
    },
    {
      key: 'assignee',
      header: 'Responsável',
      width: 'md:w-48',
      render: (task) => (
        <span className="block truncate text-slate-600">{task.assigneeName ?? '-'}</span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Data limite',
      width: 'md:w-32',
      render: (task) => <span className="text-slate-600">{formatDate(task.dueDate) ?? '-'}</span>,
    },
    {
      key: 'actions',
      header: 'Ações',
      width: 'md:w-32',
      align: 'right',
      mobileLabel: false,
      render: (task) =>
        canWrite ? (
          <Button
            variant="danger"
            onClick={() => void handleDelete(task.id, task.title)}
            loading={rowStates.get(task.id) === 'deleting'}
            loadingLabel="Excluindo…"
          >
            Excluir
          </Button>
        ) : null,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Tarefas"
        description={`${project ? `Projeto ${project.name}` : 'Projeto'}: status pendente, em andamento e concluída.`}
        actions={
          <>
            <TaskViewTabs projectId={projectId} active="lista" />
            <Button
              variant="secondary"
              onClick={() => void handleExport()}
              loading={csvBusy}
              loadingLabel="Exportando…"
            >
              Exportar
            </Button>
            {canWrite && (
              <>
                <Button variant="secondary" onClick={() => setImporting(true)}>
                  Importar
                </Button>
                <Button onClick={() => setCreating(true)}>Nova tarefa</Button>
              </>
            )}
          </>
        }
      />

      <Toolbar>
        <SearchBox
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={applySearch}
          applied={search}
          onClear={clearSearch}
          label="Buscar por título ou descrição"
          placeholder="Buscar por título ou descrição"
        />
        <FilterSelect
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TaskStatus | '');
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          {TASK_STATUSES.map((option) => (
            <option key={option} value={option}>
              {TASK_STATUS_LABELS[option]}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          value={assigneeId}
          onChange={(e) => {
            setAssigneeId(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </FilterSelect>
        <ClearFilters active={hasFilters} onClick={clearFilters} />
        <ResultCount count={meta.total} loading={loading} />
      </Toolbar>

      <DataTable
        label="Tarefas do projeto"
        columns={columns}
        rows={tasks}
        rowKey={(task) => task.id}
        loading={loading}
        error={error}
        onRetry={() => void reload()}
        rowState={(task) => rowStates.get(task.id)}
        loadingLabel="Carregando tarefas…"
        emptyTitle={
          search ? `Nenhuma tarefa encontrada para "${search}"` : 'Nenhuma tarefa encontrada.'
        }
        emptyDescription={
          hasFilters ? 'Ajuste ou limpe os filtros para ver outras tarefas.' : undefined
        }
        pagination={{ meta, onPageChange: setPage }}
      />

      {creating && projectId && (
        <NewTaskModal
          projectId={projectId}
          members={members}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
      {importing && projectId && (
        <ImportTasksModal
          projectId={projectId}
          onClose={() => setImporting(false)}
          onImported={handleImported}
        />
      )}
    </Page>
  );
}
