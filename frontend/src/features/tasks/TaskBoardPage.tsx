import { useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { Task, TaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { STATUS_TONES } from '@/utils/tone';
import { useMembers } from '@/features/projects/useMembers';
import { useProject } from '@/features/projects/useProject';
import { createTask, deleteTask, updateTask } from './tasks.service';
import { TaskViewTabs } from './TaskViewTabs';
import { useTasks } from './useTasks';

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
  onChange,
  onSubmit,
  onDelete,
  onClose,
}: TaskDetailsModalProps) {
  return (
    <Modal open title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-slate-700" htmlFor="board-task-title">
            Titulo
          </label>
          <Input
            id="board-task-title"
            required
            maxLength={200}
            value={draft.title}
            disabled={!canWrite}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-700" htmlFor="board-task-description">
            Descricao
          </label>
          <Textarea
            id="board-task-description"
            rows={3}
            maxLength={4000}
            value={draft.description}
            disabled={!canWrite}
            onChange={(e) => onChange({ ...draft, description: e.target.value })}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="board-task-assignee">
              Responsavel
            </label>
            <Select
              id="board-task-assignee"
              value={draft.assigneeId}
              disabled={!canWrite}
              onChange={(e) => onChange({ ...draft, assigneeId: e.target.value })}
            >
              <option value="">Sem responsavel</option>
              {assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-700" htmlFor="board-task-status">
              Status
            </label>
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
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-slate-700" htmlFor="board-task-due-date">
            Prazo
          </label>
          <Input
            id="board-task-due-date"
            type="date"
            value={draft.dueDate}
            disabled={!canWrite}
            onChange={(e) => onChange({ ...draft, dueDate: e.target.value })}
          />
        </div>

        {canWrite ? (
          <div className="flex items-center justify-between gap-3 pt-1">
            <Button type="button" variant="danger" size="sm" onClick={onDelete}>
              Excluir
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            Seu papel no projeto nao permite editar tarefas. O status pode ser alterado por quem tem permissao.
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
 * as tarefas e `PATCH /projects/:projectId/tasks/:taskId` para mudar o status
 * (arrastar o cartao) e salvar os detalhes.
 */
export function TaskBoardPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const { members } = useMembers(projectId);

  const [assigneeFilter, setAssigneeFilter] = useState('');
  const { tasks, loading, error, reload } = useTasks(projectId, '', assigneeFilter);

  const [search, setSearch] = useState('');
  const [moves, setMoves] = useState<Record<string, TaskStatus>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [quickTitles, setQuickTitles] = useState<Record<string, string>>({});
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const draggedRef = useRef(false);

  const canWrite = project !== null && project.role !== 'viewer';

  const visibleTasks = useMemo(() => {
    const term = search.trim().toLowerCase();

    return tasks
      .map((task) => {
        const status = moves[task.id];
        return status ? { ...task, status } : task;
      })
      .filter((task) => (term ? task.title.toLowerCase().includes(term) : true))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [tasks, moves, search]);

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

    setFormError(null);
    setMoves((prev) => ({ ...prev, [taskId]: status }));

    try {
      await updateTask(projectId, taskId, { status });
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel mover a tarefa.'));
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
    setDraft({
      title: task.title,
      description: task.description ?? '',
      assigneeId: task.assigneeId ?? '',
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    });
  }

  function closeTask() {
    setSelectedId(null);
    setDraft(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !selectedId || !draft) {
      return;
    }

    setFormError(null);
    setSaving(true);

    try {
      await updateTask(projectId, selectedId, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        assigneeId: draft.assigneeId || null,
        status: draft.status,
        dueDate: draft.dueDate || null,
      });
      closeTask();
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel salvar a tarefa.'));
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

    setFormError(null);

    try {
      await deleteTask(projectId, selectedId);
      closeTask();
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel excluir a tarefa.'));
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
    setFormError(null);

    try {
      await createTask(projectId, { title, status });
      setQuickTitles((prev) => ({ ...prev, [status]: '' }));
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel criar a tarefa.'));
    } finally {
      setCreatingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quadro</h1>
          <p className="mt-1 text-sm text-slate-600">
            {project ? `Projeto ${project.name}` : 'Projeto'} - arraste o cartao para outra coluna para
            trocar o status.
          </p>
        </div>
        <TaskViewTabs projectId={projectId} active="quadro" />
      </header>

      {formError && <Alert>{formError}</Alert>}

      <Card
        title="Tarefas do projeto"
        description={
          canWrite
            ? 'Clique no cartao para ver e editar os detalhes. As tarefas mais recentes vem primeiro.'
            : 'Somente leitura: seu papel no projeto nao permite mover nem editar tarefas.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por titulo"
              aria-label="Buscar por titulo"
              className="w-40"
            />
            <Select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label="Filtrar por responsavel"
              className="w-44"
            >
              <option value="">Todos os responsaveis</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.name}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        {loading && <p className="text-sm text-slate-600">Carregando tarefas...</p>}
        {error && <Alert>{error}</Alert>}

        {!loading && !error && visibleTasks.length === 0 && (
          <p className="mb-4 text-sm text-slate-600">Nenhuma tarefa encontrada.</p>
        )}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-3">
            {columns.map((column) => (
              <section
                key={column.status}
                aria-label={TASK_STATUS_LABELS[column.status]}
                onDragOver={(e) => handleDragOver(e, column.status)}
                onDragLeave={() => setOverStatus((current) => (current === column.status ? null : current))}
                onDrop={(e) => handleDrop(e, column.status)}
                className={`flex flex-col rounded border p-3 transition ${
                  overStatus === column.status
                    ? 'border-slate-900 bg-slate-100'
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <header className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {TASK_STATUS_LABELS[column.status]}
                  </h2>
                  <Badge tone={STATUS_TONES[column.status]}>{column.tasks.length}</Badge>
                </header>

                <ul className="flex-1 space-y-2">
                  {column.tasks.map((task) => (
                    <li key={task.id}>
                      <article
                        draggable={canWrite}
                        role="button"
                        tabIndex={0}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openTask(task)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openTask(task);
                          }
                        }}
                        className={`rounded border bg-white p-3 text-left shadow-sm transition ${
                          draggingId === task.id
                            ? 'border-slate-400 opacity-60'
                            : 'border-slate-200 hover:border-slate-300'
                        } ${canWrite ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                      >
                        <p className="text-sm font-medium text-slate-900">{task.title}</p>
                        {task.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{task.description}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge tone={STATUS_TONES[task.status]}>
                            {TASK_STATUS_LABELS[task.status]}
                          </Badge>
                          <span className="text-xs text-slate-600">
                            {task.assigneeName ?? 'Sem responsavel'}
                          </span>
                          {task.dueDate && (
                            <span className="text-xs text-slate-600">Prazo {task.dueDate.slice(0, 10)}</span>
                          )}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>

                {canWrite && (
                  <form
                    onSubmit={(e) => void handleQuickCreate(e, column.status)}
                    className="mt-3 flex items-center gap-2"
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
                    <Button type="submit" size="sm" disabled={creatingStatus === column.status}>
                      {creatingStatus === column.status ? '...' : 'Adicionar'}
                    </Button>
                  </form>
                )}
              </section>
            ))}
          </div>
        )}
      </Card>

      {draft && (
        <TaskDetailsModal
          draft={draft}
          title={selectedTask?.title ?? 'Tarefa'}
          assigneeOptions={assigneeOptions}
          canWrite={canWrite}
          saving={saving}
          onChange={setDraft}
          onSubmit={(event) => void handleSave(event)}
          onDelete={() => void handleDelete()}
          onClose={closeTask}
        />
      )}
    </div>
  );
}
