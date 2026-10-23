import { useState } from 'react';
import { FormField, Input, Select, Textarea } from '@/components/ui/Field';
import { FormModal } from '@/components/ui/FormModal';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@/types/task';
import type { TaskStatus } from '@/types/task';
import type { ProjectMember } from '@/types/project';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';
import { createTask } from './tasks.service';

type NewTaskModalProps = {
  projectId: string;
  members: ProjectMember[];
  onClose: () => void;
  /** Chamado apos criar: a pagina recarrega a lista (o modal fecha sozinho, com a animacao de saida). */
  onCreated: () => void | Promise<void>;
};

/**
 * Modal 'Nova tarefa' (D-011). O responsavel vem dos membros do projeto.
 * Monte-o so quando aberto.
 */
export function NewTaskModal({ projectId, members, onClose, onCreated }: NewTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('pendente');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit() {
    setError(null);
    setSaving(true);

    try {
      await createTask(projectId, {
        title,
        description: description || null,
        status,
        assigneeId: assigneeId || null,
        dueDate: dueDate || null,
      });
      toast.success('Tarefa criada.');
      void onCreated();
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível criar a tarefa.'));
      setSaving(false);
      return false;
    }
  }

  return (
    <FormModal
      title="Nova tarefa"
      description="A tarefa é criada neste projeto."
      size="lg"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Criar tarefa"
      savingLabel="Criando…"
      saving={saving}
      error={error}
    >
      <FormField label="Título" htmlFor="task-title">
        <Input
          id="task-title"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="O que precisa ser feito"
        />
      </FormField>
      <FormField label="Descrição" htmlFor="task-description">
        <Textarea
          id="task-description"
          rows={3}
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Status" htmlFor="task-status">
          <Select
            id="task-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((option) => (
              <option key={option} value={option}>
                {TASK_STATUS_LABELS[option]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Data limite" htmlFor="task-due-date">
          <Input
            id="task-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Responsável" htmlFor="task-assignee">
        <Select id="task-assignee" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Sem responsável</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.name} ({member.email})
            </option>
          ))}
        </Select>
      </FormField>
    </FormModal>
  );
}
