import { useId, useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal, ModalCloseButton } from '@/components/ui/Modal';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { ClearFilters, FilterSelect, ResultCount, SearchBox, Toolbar } from '@/components/ui/Toolbar';
import { MAX_PAGE_LIMIT } from '@/types/pagination';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { Task, TaskStatus } from '@/types/task';
import { useToast } from '@/stores/toastStore';
import { formatDate } from '@/utils/format';
import { notifyError } from '@/utils/notify';
import { STATUS_TONES } from '@/utils/tone';
import { useMembers } from '@/features/projects/useMembers';
import { useProject } from '@/features/projects/useProject';
import { createTask, deleteTask, updateTask } from './tasks.service';
import { TaskViewTabs } from './TaskViewTabs';
import { useAllTasks } from './useAllTasks';

type TaskDraft = {
  title: string;
  description: string;
  assigneeId: string;
  status: TaskStatus;
  dueDate: string;
};

type AssigneeOption = {
  id: string;
  label: string;
};

type TaskDetailsModalProps = {
  draft: TaskDraft;
  title: string;
  assigneeOptions: AssigneeOption[];
  canWrite: boolean;
  saving: boolean;
  deleting: boolean;
  /** Fechamento iniciado pela pagina (apos salvar/excluir): toca a saida do modal. */
  closing: boolean;
  onChange: (draft: TaskDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Detalhes da tarefa (D-011, D-012): titulo, descricao, responsavel, status e prazo.
 * O responsavel vem da lista de membros do projeto, porque o backend so aceita
 * um responsavel que seja membro.
 */
function TaskDetailsModal({
  draft,
  title,
  assigneeOptions,
  canWrite,
  saving,
  deleting,
  closing,
  onChange,
  onSubmit,
  onDelete,
  onClose,
}: TaskDetailsModalProps) {
  const formId = useId();

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      closing={closing}
      dismissible={!saving && !deleting}
      footer={
        canWrite ? (
          <>
            <Button
              variant="danger"
              onClick={onDelete}
              loading={deleting}
              loadingLabel="Excluindo…"
              disabled={saving}
              className="mr-auto"
            >
              Excluir
            </Button>
            <ModalCloseButton variant="secondary" disabled={saving || deleting}>
              Cancelar
            </ModalCloseButton>
            <Button type="submit" form={formId} loading={saving} loadingLabel="Salvando…" disabled={deleting}>
              Salvar
            </Button>
          </>
        ) : undefined
      }
    >
      <form id={formId} onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField label="Título" htmlFor="board-task-title">
          <Input
            id="board-task-title"
            required
            maxLength={200}
            value={draft.title}
            disabled={!canWrite}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </FormField>

        <FormField label="Descrição" htmlFor="board-task-description">
          <Textarea
            id="board-task-description"
            rows={3}
            maxLength={4000}
            value={draft.description}
            disabled={!canWrite}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Responsável" htmlFor="board-task-assignee">
            <Select
              id="board-task-assignee"
              value={draft.assigneeId}
              disabled={!canWrite}
              onChange={(e) => onChange({ ...draft, assigneeId: e.target.value })}
            >
              <option value="">Sem responsável</option>
              {assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Status" htmlFor="board-task-status">
            <Select
              id="board-task-status"
              value={draft.status}
              disabled={!canWrite}
              onChange={(e) => onChange({ ...draft, status: e.target.value as TaskStatus })}
            >
              {TASK_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {TASK_STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Data limite" htmlFor="board-task-due-date">
          <Input
            id="board-task-due-date"
            type="date"
            value={draft.dueDate}
            disabled={!canWrite}
            onChange={(e) => onChange({ ...draft, dueDate: e.target.value })}
          />
        </FormField>

        {!canWrite && (
          <p className="text-caption text-slate-500">
            Seu papel no projeto não permite editar tarefas. O status pode ser alterado por quem tem permissão.
          </p>
        )}
      </form>
    </Modal>
  );
}

/**
 * Quadro Kanban das tarefas do projeto (D-012).
 *
 * Usa apenas os endpoints existentes: `GET /projects/:projectId/tasks` para ler
 * as tarefas (todas as paginas, via `useAllTasks`) e
 * `PATCH /projects/:projectId/tasks/:taskId` para mudar o status (arrastar o
 * cartao) e salvar os detalhes.
 */
export function TaskBoardPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const { data: members } = useMembers(projectId, MAX_PAGE_LIMIT);

  const [assigneeFilter, setAssigneeFilter] = useState('');
  /** Texto digitado no campo. Só vira `search` (valor aplicado no servidor) ao apertar Enter, como na lista. */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const { data: tasks, loading, loaded, error, progress, reload } = useAllTasks(
    projectId,
    assigneeFilter,
    search || undefined,
  );
  const toast = useToast();

  const [moves, setMoves] = useState<Record<string, TaskStatus>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [quickTitles, setQuickTitles] = useState<Record<string, string>>({});
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState('Tarefa');
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [closingTask, setClosingTask] = useState(false);
  const draggedRef = useRef(false);

  const canWrite = project !== null && project.role !== 'viewer';

  const visibleTasks = useMemo(() => {
    return tasks
      .map((task) => {
        const status = moves[task.id];
        return status ? { ...task, status } : task;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [tasks, moves]);

  const columns = useMemo(
    () =>
      TASK_STATUSES.map((status) => ({
        status,
        tasks: visibleTasks.filter((task) => task.status === status),
      })),
    [visibleTasks],
  );

  const selectedTask = useMemo(
    () => visibleTasks.find((task) => task.id === selectedId) ?? null,
    [visibleTasks, selectedId],
  );
  const initialLoading = loading && !loaded;

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const options: AssigneeOption[] = members.map((member) => ({
      id: member.userId,
      label: `${member.name} (${member.email})`,
    }));

    const current = draft?.assigneeId;
    if (current && !options.some((option) => option.id === current)) {
      options.push({ id: current, label: selectedTask?.assigneeName ?? current });
    }

    return options;
  }, [members, draft?.assigneeId, selectedTask?.assigneeName]);

  /**
   * Move o cartao para outra coluna: o status vai por PATCH.
   * A mudanca e otimista e volta ao lugar original se o backend recusar.
   */
  async function moveTask(taskId: string, status: TaskStatus) {
    if (!projectId || !canWrite) {
      return;
    }

    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) {
      return;
    }

    setMoves((prev) => ({ ...prev, [taskId]: status }));

    try {
      await updateTask(projectId, taskId, { status });
      toast.success(`Tarefa movida para ${TASK_STATUS_LABELS[status]}.`);
      await reload();
    } catch (err) {
      // O `finally` desfaz a mudanca otimista: o cartao volta para a coluna de origem.
      notifyError(err, 'Não foi possível mover a tarefa. O cartão voltou para a coluna anterior.');
    } finally {
      setMoves((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }
  }

  function handleDragStart(event: DragEvent<HTMLElement>, taskId: string) {
    if (!canWrite) {
      return;
    }

    draggedRef.current = true;
    event.dataTransfer.setData('text/plain', taskId);
    event.dataTransfer.effectAllowed = 'move';

    // Imagem de arraste "levantada": copia do cartao com sombra (o original vira o placeholder).
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true) as HTMLElement;
    ghost.classList.add('kanban-drag-ghost');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, event.clientX - rect.left, event.clientY - rect.top);
    window.setTimeout(() => ghost.remove(), 0);

    setDraggingId(taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverStatus(null);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (!canWrite) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setOverStatus(status);
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();

    const taskId = event.dataTransfer.getData('text/plain');
    handleDragEnd();

    if (taskId) {
      void moveTask(taskId, status);
    }
  }

  function openTask(task: Task) {
    if (draggedRef.current) {
      return;
    }

    setSelectedId(task.id);
    setSelectedTitle(task.title);
    setClosingTask(false);
    setDraft({
      title: task.title,
      description: task.description ?? '',
      assigneeId: task.assigneeId ?? '',
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
  }

  /** Chamado pelo modal depois da animacao de saida. */
  function closeTask() {
    setSelectedId(null);
    setDraft(null);
    setClosingTask(false);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !selectedId || !draft) {
      return;
    }

    setSaving(true);

    try {
      await updateTask(projectId, selectedId, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        assigneeId: draft.assigneeId || null,
        status: draft.status,
        dueDate: draft.dueDate || null,
      });
      toast.success('Tarefa atualizada.');
      setClosingTask(true);
      void reload();
    } catch (err) {
      notifyError(err, 'Não foi possível salvar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!projectId || !selectedId || !draft) {
      return;
    }

    if (!window.confirm(`Excluir a tarefa "${draft.title}"?`)) {
      return;
    }

    setDeleting(true);

    try {
      await deleteTask(projectId, selectedId);
      toast.success('Tarefa excluída.');
      setClosingTask(true);
      void reload();
    } catch (err) {
      notifyError(err, 'Não foi possível excluir a tarefa.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleQuickCreate(event: FormEvent, status: TaskStatus) {
    event.preventDefault();
    if (!projectId) {
      return;
    }

    const title = (quickTitles[status] ?? '').trim();
    if (!title) {
      return;
    }

    setCreatingStatus(status);

    try {
      await createTask(projectId, { title, status });
      setQuickTitles((prev) => ({ ...prev, [status]: '' }));
      toast.success('Tarefa criada.');
      await reload();
    } catch (err) {
      notifyError(err, 'Não foi possível criar a tarefa.');
    } finally {
      setCreatingStatus(null);
    }
  }

  const hasFilters = search !== '' || assigneeFilter !== '';

  function applySearch(term: string) {
    setSearch(term.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
  }

  return (
    <Page>
      <PageHeader
        title="Quadro"
        description={`${project ? `Projeto ${project.name}` : 'Projeto'}: arraste o cartão para outra coluna para trocar o status.`}
        actions={<TaskViewTabs projectId={projectId} active="quadro" />}
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
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filtrar por responsável"
        >
          <option value="">Todos os responsáveis</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name}
            </option>
          ))}
        </FilterSelect>
        <ClearFilters
          active={hasFilters}
          onClick={() => {
            clearSearch();
            setAssigneeFilter('');
          }}
        />
        <ResultCount count={visibleTasks.length} loading={loading} />
      </Toolbar>

      <p className="max-w-prose text-body text-slate-600">
        {canWrite
          ? 'Clique no cartão para ver e editar os detalhes. As tarefas mais recentes vêm primeiro.'
          : 'Somente leitura: seu papel no projeto não permite mover nem editar tarefas.'}
      </p>

      <div>
        {initialLoading && !error && (
          <div role="status" aria-label="Carregando tarefas…" className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-body text-slate-600">
              <Spinner />
              <span>
                {progress && progress.totalPages > 1
                  ? `Carregando tarefas… (página ${progress.page} de ${progress.totalPages})`
                  : 'Carregando tarefas…'}
              </span>
            </p>
            <div aria-hidden="true" className="grid gap-6 lg:grid-cols-3">
              {TASK_STATUSES.map((status) => (
                <div key={status} className="flex flex-col gap-3 rounded-surface border border-slate-200 bg-slate-50 p-compact">
                  <Skeleton className="w-1/3" />
                  <Skeleton variant="card" className="w-full" />
                  <Skeleton variant="card" className="w-full" />
                </div>
              ))}
            </div>
          </div>
        )}
        {error && <ErrorState message={error} onRetry={() => void reload()} retrying={loading} />}

        {loaded && !error && visibleTasks.length === 0 && (
          <p className="mb-6 text-body text-slate-600">Nenhuma tarefa encontrada.</p>
        )}

        {loaded && !error && (
          <div aria-busy={loading} className="grid gap-6 lg:grid-cols-3">
            {columns.map((column) => (
              <section
                key={column.status}
                aria-label={TASK_STATUS_LABELS[column.status]}
                onDragOver={(e) => handleDragOver(e, column.status)}
                onDragLeave={() => setOverStatus((current) => (current === column.status ? null : current))}
                onDrop={(e) => handleDrop(e, column.status)}
                className={`flex min-h-64 flex-col gap-4 rounded-surface border p-compact transition ${
                  overStatus === column.status
                    ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-300'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <header className="flex items-center justify-between gap-3">
                  <h2 className="text-body font-semibold text-slate-900">
                    {TASK_STATUS_LABELS[column.status]}
                  </h2>
                  <Badge tone={STATUS_TONES[column.status]}>{column.tasks.length}</Badge>
                </header>

                <ul className="flex flex-1 flex-col gap-3">
                  {column.tasks.map((task) => {
                    const moving = task.id in moves;

                    return (
                      <li key={task.id}>
                        <article
                          draggable={canWrite && !moving}
                          role="button"
                          tabIndex={0}
                          aria-busy={moving || undefined}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => openTask(task)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openTask(task);
                            }
                          }}
                          className={`relative flex animate-settle flex-col gap-2 rounded-control border bg-white p-compact text-left shadow-sm transition ${
                            draggingId === task.id
                              ? 'border-dashed border-slate-400 bg-slate-100 opacity-50 shadow-none'
                              : moving
                                ? 'border-slate-300 opacity-80'
                                : 'border-slate-200 hover:border-slate-300 hover:shadow-md active:shadow-sm'
                          } ${canWrite ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                        >
                          <p className="text-body font-medium text-slate-900">{task.title}</p>
                          {task.description && (
                            <p className="line-clamp-2 text-caption text-slate-600">{task.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={STATUS_TONES[task.status]}>
                              {TASK_STATUS_LABELS[task.status]}
                            </Badge>
                            <span className="text-caption text-slate-600">
                              {task.assigneeName ?? 'Sem responsável'}
                            </span>
                            {task.dueDate && (
                              <span className="text-caption text-slate-600">Data limite {formatDate(task.dueDate)}</span>
                            )}
                          </div>
                          {moving && (
                            <span className="pointer-events-none absolute right-3 top-3 text-slate-500">
                              <Spinner label="Salvando…" />
                            </span>
                          )}
                        </article>
                      </li>
                    );
                  })}
                </ul>

                {canWrite && (
                  <form
                    onSubmit={(e) => void handleQuickCreate(e, column.status)}
                    className="flex items-center gap-3"
                  >
                    <Input
                      value={quickTitles[column.status] ?? ''}
                      onChange={(e) =>
                        setQuickTitles((prev) => ({ ...prev, [column.status]: e.target.value }))
                      }
                      placeholder="Nova tarefa"
                      maxLength={200}
                      aria-label={`Nova tarefa em ${TASK_STATUS_LABELS[column.status]}`}
                    />
                    <Button
                      type="submit"
                      loading={creatingStatus === column.status}
                      loadingLabel="Adicionando…"
                    >
                      Adicionar
                    </Button>
                  </form>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {draft && (
        <TaskDetailsModal
          draft={draft}
          title={selectedTask?.title ?? selectedTitle}
          assigneeOptions={assigneeOptions}
          canWrite={canWrite}
          saving={saving}
          deleting={deleting}
          closing={closingTask}
          onChange={setDraft}
          onSubmit={(event) => void handleSave(event)}
          onDelete={() => void handleDelete()}
          onClose={closeTask}
        />
      )}
    </Page>
  );
}
