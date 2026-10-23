import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Textarea } from '@/components/ui/Field';
import { Modal, ModalCloseButton } from '@/components/ui/Modal';
import type { ProjectMember } from '@/types/project';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { Task, TaskStatus } from '@/types/task';
import { useConfirm } from '@/stores/confirmStore';
import { useToast } from '@/stores/toastStore';
import { notifyError } from '@/utils/notify';
import { deleteTask, updateTask } from './tasks.service';

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
  projectId: string;
  task: Task;
  /** Membros do projeto: o backend so aceita um responsavel que seja membro. */
  members: ProjectMember[];
  /** Papel que escreve tarefas (owner, admin, member). Viewer ve tudo somente leitura. */
  canWrite: boolean;
  /** Depois de salvar ou excluir: a pagina recarrega a lista/quadro (o modal fecha sozinho). */
  onChanged: () => void | Promise<void>;
  /** Fim da animacao de saida: a pagina desmonta o modal. */
  onClose: () => void;
};

function draftOf(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? '',
    assigneeId: task.assigneeId ?? '',
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
  };
}

/**
 * Detalhes e edicao da tarefa (D-011, D-012), o mesmo na lista e no quadro: titulo, descricao,
 * responsavel (trocar ou remover), status, data limite e excluir (com confirmacao). Para quem
 * so le o projeto (viewer) os campos ficam desabilitados e nao ha rodape de acoes.
 * Monte-o so quando for abrir (o rascunho nasce da tarefa recebida).
 */
export function TaskDetailsModal({
  projectId,
  task,
  members,
  canWrite,
  onChanged,
  onClose,
}: TaskDetailsModalProps) {
  const formId = useId();
  const fieldId = useId();
  const [draft, setDraft] = useState<TaskDraft>(() => draftOf(task));
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  const assigneeOptions = useMemo<AssigneeOption[]>(() => {
    const options = members.map((member) => ({
      id: member.userId,
      label: `${member.name} (${member.email})`,
    }));

    // Responsavel atual que nao veio na lista de membros (ex.: lista ainda carregando).
    if (task.assigneeId && !options.some((option) => option.id === task.assigneeId)) {
      options.push({ id: task.assigneeId, label: task.assigneeName ?? task.assigneeId });
    }

    return options;
  }, [members, task.assigneeId, task.assigneeName]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await updateTask(projectId, task.id, {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        assigneeId: draft.assigneeId || null,
        status: draft.status,
        dueDate: draft.dueDate || null,
      });
      toast.success('Tarefa atualizada.');
      setClosing(true);
      void onChanged();
    } catch (err) {
      notifyError(err, 'Não foi possível salvar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      const deleted = await confirm({
        title: 'Excluir tarefa?',
        description: `Esta ação não pode ser desfeita. A tarefa "${task.title}" será excluída.`,
        confirmLabel: 'Excluir',
        loadingLabel: 'Excluindo…',
        action: () => deleteTask(projectId, task.id),
      });
      if (!deleted) return;

      toast.success('Tarefa excluída.');
      setClosing(true);
      void onChanged();
    } catch (err) {
      notifyError(err, 'Não foi possível excluir a tarefa.');
    }
  }

  const id = (name: string) => `${fieldId}-${name}`;

  return (
    <Modal
      open
      title={task.title}
      onClose={onClose}
      closing={closing}
      dismissible={!saving}
      footer={
        canWrite ? (
          <>
            <Button variant="danger" onClick={() => void handleDelete()} disabled={saving} className="mr-auto">
              Excluir
            </Button>
            <ModalCloseButton variant="secondary" disabled={saving}>
              Cancelar
            </ModalCloseButton>
            <Button type="submit" form={formId} loading={saving} loadingLabel="Salvando…">
              Salvar
            </Button>
          </>
        ) : undefined
      }
    >
      <form id={formId} onSubmit={(event) => void handleSave(event)} className="flex flex-col gap-4">
        <FormField label="Título" htmlFor={id('title')}>
          <Input
            id={id('title')}
            required
            maxLength={200}
            value={draft.title}
            disabled={!canWrite}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </FormField>

        <FormField label="Descrição" htmlFor={id('description')}>
          <Textarea
            id={id('description')}
            rows={3}
            maxLength={4000}
            value={draft.description}
            disabled={!canWrite}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Responsável" htmlFor={id('assignee')}>
            <Select
              id={id('assignee')}
              value={draft.assigneeId}
              disabled={!canWrite}
              onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
            >
              <option value="">Sem responsável</option>
              {assigneeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Status" htmlFor={id('status')}>
            <Select
              id={id('status')}
              value={draft.status}
              disabled={!canWrite}
              onChange={(e) => setDraft({ ...draft, status: e.target.value as TaskStatus })}
            >
              {TASK_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {TASK_STATUS_LABELS[option]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Data limite" htmlFor={id('due-date')}>
          <Input
            id={id('due-date')}
            type="date"
            value={draft.dueDate}
            disabled={!canWrite}
            onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
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
