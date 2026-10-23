import { useMemo, useRef, useState } from 'react';
import type { DragEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { ErrorState } from '@/components/ui/ErrorState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Page } from '@/components/ui/Page';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { ClearFilters, FilterSelect, ResultCount, SearchBox, Toolbar } from '@/components/ui/Toolbar';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { MAX_PAGE_LIMIT } from '@/types/pagination';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { Task, TaskStatus } from '@/types/task';
import { useToast } from '@/stores/toastStore';
import { formatDate, formatNumber } from '@/utils/format';
import { notifyError } from '@/utils/notify';
import { STATUS_TONES } from '@/utils/tone';
import { ProjectUnavailable } from '@/features/projects/ProjectUnavailable';
import { useMembers } from '@/features/projects/useMembers';
import { useProject } from '@/features/projects/useProject';
import {
  BOARD_COLUMN_PAGE,
  buildColumns,
  columnWindow,
  isTaskDrag,
  leftColumn,
  TASK_DRAG_TYPE,
} from './board';
import { BOARD_MAX_TASKS, createTask, updateTask } from './tasks.service';
import { TaskDetailsModal } from './TaskDetailsModal';
import { TaskViewTabs } from './TaskViewTabs';
import { useAllTasks } from './useAllTasks';

/**
 * Quadro Kanban das tarefas do projeto (D-012).
 *
 * Usa apenas os endpoints existentes: `GET /projects/:projectId/tasks` para ler as tarefas
 * (ate 5.000, via `useAllTasks`) e `PATCH /projects/:projectId/tasks/:taskId` para mudar o
 * status (arrastar o cartao). Cada coluna rola sozinha, tem a criacao rapida no topo e mostra
 * 50 cartoes por vez ("Mostrar mais"), com a contagem total no cabecalho (KAN-11, KAN-15).
 */
export function TaskBoardPage() {
  const { projectId } = useParams();
  const projectState = useProject(projectId);
  const { project } = projectState;
  const { data: members, reload: reloadMembers } = useMembers(projectId, MAX_PAGE_LIMIT);

  const [assigneeFilter, setAssigneeFilter] = useState('');
  /** Texto digitado no campo. Só vira `search` (valor aplicado no servidor) ao apertar Enter, como na lista. */
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const {
    data: tasks,
    total,
    truncated,
    loading,
    loaded,
    error,
    progress,
    reload,
  } = useAllTasks(projectId, assigneeFilter, search || undefined);
  const toast = useToast();

  const [moves, setMoves] = useState<Record<string, TaskStatus>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);
  const [quickTitles, setQuickTitles] = useState<Record<string, string>>({});
  const [creatingStatus, setCreatingStatus] = useState<TaskStatus | null>(null);
  /** Quantos cartoes cada coluna mostra (cresce de 50 em 50 com "Mostrar mais"). */
  const [limits, setLimits] = useState<Partial<Record<TaskStatus, number>>>({});
  const [selected, setSelected] = useState<Task | null>(null);
  const draggedRef = useRef(false);

  useDocumentTitle(project ? `Quadro — ${project.name}` : 'Quadro');

  const canWrite = project !== null && project.role !== 'viewer';

  const columns = useMemo(() => buildColumns(tasks, moves), [tasks, moves]);
  const totalLoaded = tasks.length;
  const initialLoading = loading && !loaded;

  /** "Tentar novamente" recarrega tudo o que a tela usa: projeto (e papel), membros e tarefas. */
  function retryAll() {
    void projectState.reload();
    void reloadMembers();
    void reload();
  }

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
    event.dataTransfer.setData(TASK_DRAG_TYPE, taskId);
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

  /** Qualquer ponto da coluna (cabecalho, criacao rapida, lista) aceita o cartao (C6-06). */
  function handleDragOver(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (!canWrite || !isTaskDrag(event.dataTransfer.types)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setOverStatus(status);
  }

  function handleDragLeave(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (leftColumn(event.currentTarget, event.relatedTarget as Node | null)) {
      setOverStatus((current) => (current === status ? null : current));
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    if (!isTaskDrag(event.dataTransfer.types)) {
      return;
    }

    // preventDefault tambem impede o navegador de inserir algo no campo "Nova tarefa".
    event.preventDefault();

    const taskId = event.dataTransfer.getData(TASK_DRAG_TYPE);
    handleDragEnd();

    if (taskId) {
      void moveTask(taskId, status);
    }
  }

  function openTask(task: Task) {
    if (!draggedRef.current) {
      setSelected(task);
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

  /** Filtro novo: cada coluna volta a mostrar so os primeiros 50 cartoes. */
  function applySearch(term: string) {
    setSearch(term.trim());
    setLimits({});
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
    setLimits({});
  }

  // Sem o projeto (e o papel do usuario nele) a tela ficaria "pela metade": esqueleto ou erro.
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
        title="Quadro"
        description={`Projeto ${project.name}: arraste o cartão para outra coluna para trocar o status.`}
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
          onChange={(e) => {
            setAssigneeFilter(e.target.value);
            setLimits({});
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
        <ClearFilters
          active={hasFilters}
          onClick={() => {
            clearSearch();
            setAssigneeFilter('');
          }}
        />
        {/* Total real do servidor (meta.total), mesmo acima do teto de 5.000 carregadas. */}
        <ResultCount count={total} loading={loading} />
      </Toolbar>

      <p className="max-w-prose text-body text-slate-600">
        {canWrite
          ? 'Clique no cartão para ver e editar os detalhes. As tarefas mais recentes vêm primeiro.'
          : 'Somente leitura: seu papel no projeto não permite mover nem editar tarefas.'}
      </p>

      {truncated && !error && (
        <Alert tone="info">
          {`Exibindo as ${formatNumber(BOARD_MAX_TASKS)} tarefas mais recentes. Use a busca ou os filtros para refinar.`}
        </Alert>
      )}

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
        {error && <ErrorState message={error} onRetry={retryAll} retrying={loading} />}

        {loaded && !error && totalLoaded === 0 && (
          <p className="mb-6 text-body text-slate-600">Nenhuma tarefa encontrada.</p>
        )}

        {loaded && !error && (
          <div aria-busy={loading} className="grid items-start gap-6 lg:grid-cols-3">
            {columns.map((column) => {
              const label = TASK_STATUS_LABELS[column.status];
              const { shown, remaining } = columnWindow(
                column.tasks.length,
                limits[column.status] ?? BOARD_COLUMN_PAGE,
              );

              return (
                // Alvo de soltar: a coluna INTEIRA (borda, cabecalho, criacao rapida e lista), com
                // rolagem propria. Os eventos de qualquer filho (inclusive da <section>) sobem ate aqui.
                <div
                  key={column.status}
                  data-drop-status={column.status}
                  onDragOver={(e) => handleDragOver(e, column.status)}
                  onDragLeave={(e) => handleDragLeave(e, column.status)}
                  onDrop={(e) => handleDrop(e, column.status)}
                  className={`flex max-h-kanban-column min-h-64 flex-col rounded-surface border p-compact transition ${
                    overStatus === column.status
                      ? 'border-slate-900 bg-slate-100 ring-2 ring-slate-300'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <section aria-label={label} className="flex min-h-0 flex-1 flex-col gap-4">
                    <header className="flex items-center justify-between gap-3">
                      <h2 className="text-body font-semibold text-slate-900">{label}</h2>
                      <Badge tone={STATUS_TONES[column.status]}>{formatNumber(column.tasks.length)}</Badge>
                    </header>

                    {/* Criacao rapida no TOPO: sempre a mao, mesmo com a coluna cheia (KAN-11). */}
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
                          aria-label={`Nova tarefa em ${label}`}
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

                    <ul
                      aria-label={`Tarefas em ${label}`}
                      className="-m-1 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-1"
                    >
                      {column.tasks.slice(0, shown).map((task) => {
                        const moving = task.id in moves;

                        return (
                          <li key={task.id}>
                            <div
                              draggable={canWrite && !moving}
                              aria-busy={moving || undefined}
                              onDragStart={(e) => handleDragStart(e, task.id)}
                              onDragEnd={handleDragEnd}
                              className={`relative flex animate-settle flex-col gap-2 rounded-control border bg-white p-compact text-left shadow-sm transition has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-slate-900 ${
                                draggingId === task.id
                                  ? 'border-dashed border-slate-400 bg-slate-100 opacity-50 shadow-none'
                                  : moving
                                    ? 'border-slate-300 opacity-80'
                                    : 'border-slate-200 hover:border-slate-300 hover:shadow-md active:shadow-sm'
                              } ${canWrite ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                            >
                              {/* O botao do titulo cobre o cartao (after:inset-0): clique e teclado abrem o detalhe. */}
                              <button
                                type="button"
                                onClick={() => openTask(task)}
                                className="text-left text-body font-medium text-slate-900 outline-none after:absolute after:inset-0 after:rounded-control"
                              >
                                {task.title}
                              </button>
                              {task.description && (
                                <p className="line-clamp-2 text-caption text-slate-600">{task.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                                <span className="text-caption text-slate-600">
                                  {task.assigneeName ?? 'Sem responsável'}
                                </span>
                                {task.dueDate && (
                                  <span className="text-caption text-slate-600">
                                    Data limite {formatDate(task.dueDate)}
                                  </span>
                                )}
                              </div>
                              {moving && (
                                <span className="pointer-events-none absolute right-3 top-3 text-slate-500">
                                  <Spinner label="Salvando…" />
                                </span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {remaining > 0 && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={() =>
                          setLimits((prev) => ({
                            ...prev,
                            [column.status]: shown + BOARD_COLUMN_PAGE,
                          }))
                        }
                      >
                        {`Mostrar mais (${formatNumber(remaining)} ${remaining === 1 ? 'restante' : 'restantes'})`}
                      </Button>
                    )}
                  </section>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && projectId && (
        <TaskDetailsModal
          key={selected.id}
          projectId={projectId}
          task={selected}
          members={members}
          canWrite={canWrite}
          onChanged={reload}
          onClose={() => setSelected(null)}
        />
      )}
    </Page>
  );
}
