import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { ImportResult, TaskStatus } from '@/types/task';
import { errorMessage } from '@/utils/errorMessage';
import { STATUS_TONES } from '@/utils/tone';
import { useMembers } from '@/features/projects/useMembers';
import { useProject } from '@/features/projects/useProject';
import { createTask, deleteTask, exportTasksCsv, importTasksCsv, updateTask } from './tasks.service';
import { TaskViewTabs } from './TaskViewTabs';
import { useTasks } from './useTasks';

/**
 * Tarefas do projeto (D-011, D-012) com exportacao e importacao em CSV (D-014).
 */
export function TasksPage() {
  const { projectId } = useParams();
  const { project } = useProject(projectId);
  const { members } = useMembers(projectId);
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  const { tasks, loading, error, reload } = useTasks(projectId, status, assigneeId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newStatus, setNewStatus] = useState<TaskStatus>('pendente');
  const [newAssignee, setNewAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [csvBusy, setCsvBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const canWrite = project !== null && project.role !== 'viewer';

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!projectId) return;

    setFormError(null);
    setSaving(true);

    try {
      await createTask(projectId, {
        title,
        description: description || null,
        status: newStatus,
        assigneeId: newAssignee || null,
        dueDate: dueDate || null,
      });
      setTitle('');
      setDescription('');
      setNewStatus('pendente');
      setNewAssignee('');
      setDueDate('');
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel criar a tarefa.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(taskId: string, nextStatus: TaskStatus) {
    if (!projectId) return;

    setFormError(null);

    try {
      await updateTask(projectId, taskId, { status: nextStatus });
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel alterar o status da tarefa.'));
    }
  }

  async function handleDelete(taskId: string, taskTitle: string) {
    if (!projectId) return;
    if (!window.confirm(`Excluir a tarefa "${taskTitle}"?`)) {
      return;
    }

    setFormError(null);

    try {
      await deleteTask(projectId, taskId);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel excluir a tarefa.'));
    }
  }

  async function handleExport() {
    if (!projectId) return;

    setCsvBusy(true);
    setFormError(null);

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
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel exportar o CSV.'));
    } finally {
      setCsvBusy(false);
    }
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !projectId) return;

    setCsvBusy(true);
    setFormError(null);
    setImportResult(null);

    try {
      const result = await importTasksCsv(projectId, await file.text());
      setImportResult(result);
      await reload();
    } catch (err) {
      setFormError(errorMessage(err, 'Nao foi possivel importar o CSV.'));
    } finally {
      setCsvBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tarefas</h1>
          <p className="mt-1 text-sm text-slate-600">
            {project ? `Projeto ${project.name}` : 'Projeto'} - status pendente, em andamento e concluida.
          </p>
        </div>
        <TaskViewTabs projectId={projectId} active="lista" />
      </header>

      {formError && <Alert>{formError}</Alert>}

      <Card
        title="CSV"
        description="Colunas: titulo,descricao,status,responsavel_email,data_limite"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => void handleExport()} disabled={csvBusy}>
              Exportar
            </Button>
            <label className="cursor-pointer rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Importar
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void handleImport(e)}
                disabled={csvBusy}
              />
            </label>
          </>
        }
      >
        {importResult && (
          <div className="space-y-2">
            <Alert tone="success">{importResult.created} tarefa(s) criada(s) pela importacao.</Alert>
            {importResult.errors.length > 0 && (
              <ul className="space-y-1 text-sm text-red-700">
                {importResult.errors.map((item) => (
                  <li key={`${item.row}-${item.message}`}>
                    Linha {item.row}: {item.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      {canWrite && (
        <Card title="Nova tarefa">
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-slate-700" htmlFor="task-title">
                Titulo
              </label>
              <Input
                id="task-title"
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="O que precisa ser feito"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-slate-700" htmlFor="task-description">
                Descricao
              </label>
              <Textarea
                id="task-description"
                rows={2}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm text-slate-700" htmlFor="task-status">
                  Status
                </label>
                <Select
                  id="task-status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TaskStatus)}
                >
                  {TASK_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {TASK_STATUS_LABELS[option]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700" htmlFor="task-assignee">
                  Responsavel
                </label>
                <Select
                  id="task-assignee"
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                >
                  <option value="">Sem responsavel</option>
                  {members.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-700" htmlFor="task-due-date">
                  Data limite
                </label>
                <Input
                  id="task-due-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Criando...' : 'Criar tarefa'}
            </Button>
          </form>
        </Card>
      )}

      <Card
        title="Tarefas do projeto"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus | '')}
              className="w-40"
            >
              <option value="">Todos os status</option>
              {TASK_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {TASK_STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
            <Select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-48"
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
        {!loading && !error && tasks.length === 0 && (
          <p className="text-sm text-slate-600">Nenhuma tarefa encontrada.</p>
        )}

        {tasks.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Tarefa</th>
                <th className="py-2">Status</th>
                <th className="py-2">Responsavel</th>
                <th className="py-2">Prazo</th>
                <th className="py-2 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td className="py-2">
                    <p className="font-medium text-slate-900">{task.title}</p>
                    {task.description && (
                      <p className="mt-0.5 text-xs text-slate-600">{task.description}</p>
                    )}
                  </td>
                  <td className="py-2">
                    {canWrite ? (
                      <Select
                        value={task.status}
                        onChange={(e) => void handleStatusChange(task.id, e.target.value as TaskStatus)}
                        className="w-40"
                      >
                        {TASK_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {TASK_STATUS_LABELS[option]}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Badge tone={STATUS_TONES[task.status]}>{TASK_STATUS_LABELS[task.status]}</Badge>
                    )}
                  </td>
                  <td className="py-2 text-slate-600">{task.assigneeName ?? '-'}</td>
                  <td className="py-2 text-slate-600">{task.dueDate ?? '-'}</td>
                  <td className="py-2 text-right">
                    {canWrite && (
                      <Button variant="danger" size="sm" onClick={() => void handleDelete(task.id, task.title)}>
                        Excluir
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
