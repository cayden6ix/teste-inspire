import { useState } from 'react';
import { FormField, Input, Textarea } from '@/components/ui/Field';
import { FormModal } from '@/components/ui/FormModal';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';
import { createProject } from './projects.service';

type NewProjectModalProps = {
  onClose: () => void;
  /** Chamado apos criar: a pagina recarrega a lista (o modal fecha sozinho, com a animacao de saida). */
  onCreated: () => void | Promise<void>;
};

/**
 * Modal 'Novo projeto' (D-011). Monte-o so quando aberto.
 */
export function NewProjectModal({ onClose, onCreated }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handleSubmit() {
    setError(null);
    setSaving(true);

    try {
      await createProject({ name, description: description || null });
      toast.success('Projeto criado.');
      void onCreated();
      return true;
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível criar o projeto.'));
      setSaving(false);
      return false;
    }
  }

  return (
    <FormModal
      title="Novo projeto"
      description="Todo projeto tem membros com papéis e tarefas no seu contexto."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Criar projeto"
      savingLabel="Criando…"
      saving={saving}
      error={error}
    >
      <FormField label="Nome" htmlFor="project-name">
        <Input
          id="project-name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do projeto"
        />
      </FormField>
      <FormField label="Descrição" htmlFor="project-description">
        <Textarea
          id="project-description"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Opcional"
        />
      </FormField>
    </FormModal>
  );
}
