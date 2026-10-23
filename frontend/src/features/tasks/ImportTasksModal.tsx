import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/Field';
import { FormModal } from '@/components/ui/FormModal';
import { Modal, ModalCloseButton } from '@/components/ui/Modal';
import type { ImportResult } from '@/types/task';
import { useToast } from '@/stores/toastStore';
import { errorMessage } from '@/utils/errorMessage';
import { csvFileProblem } from './importFile';
import { importTasksCsv } from './tasks.service';

type ImportTasksModalProps = {
  projectId: string;
  onClose: () => void;
  /** Chamado apos importar (com ou sem linhas invalidas): a pagina recarrega a lista. O modal fecha sozinho. */
  onImported: (result: ImportResult) => void | Promise<void>;
};

/**
 * Modal 'Importar' CSV de tarefas (D-014). Sem linhas invalidas fecha sozinho;
 * com linhas invalidas continua aberto listando o motivo de cada uma.
 * Monte-o so quando aberto.
 */
export function ImportTasksModal({ projectId, onClose, onImported }: ImportTasksModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function handleSubmit() {
    // Sem arquivo ou arquivo de 0 bytes: explica no modal, sem chamar a API.
    const problem = csvFileProblem(file);
    if (problem || !file) {
      setError(problem);
      return false;
    }

    setError(null);
    setBusy(true);

    try {
      const imported = await importTasksCsv(projectId, file);

      // Defesa: a API ja recusa (400, com o motivo) arquivo sem linhas de tarefa.
      if (imported.created === 0 && imported.errors.length === 0) {
        setError('Nenhuma tarefa foi importada: o arquivo não tem linhas de tarefa depois do cabeçalho.');
        setBusy(false);
        return false;
      }

      void onImported(imported);

      if (imported.errors.length === 0) {
        toast.success(`${imported.created} tarefa(s) importada(s).`);
        return true;
      }

      toast.warning({
        title: imported.created === 0 ? 'Nenhuma tarefa foi importada.' : 'Importação concluída com avisos.',
        description: `${imported.created} tarefa(s) importada(s); ${imported.errors.length} linha(s) não foram importadas.`,
      });
      setResult(imported);
      setBusy(false);
      return false;
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível importar o CSV.'));
      setBusy(false);
      return false;
    }
  }

  if (result) {
    return (
      <Modal
        open
        title="Importar tarefas (CSV)"
        size="md"
        onClose={onClose}
        enterAnimation={false}
        footer={<ModalCloseButton>Fechar</ModalCloseButton>}
      >
        <div className="flex flex-col gap-4">
          {result.created === 0 ? (
            <Alert>Nenhuma tarefa foi importada: todas as linhas têm erro. Corrija o arquivo e importe de novo.</Alert>
          ) : (
            <Alert tone="success">{result.created} tarefa(s) criada(s) pela importação.</Alert>
          )}
          <p className="text-body font-medium text-slate-800">
            {result.errors.length} linha(s) não foram importadas:
          </p>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-control border border-red-100 bg-red-50/50 p-compact text-body text-red-700">
            {result.errors.map((item) => (
              <li key={`${item.row}-${item.message}`}>
                Linha {item.row}: {item.message}
              </li>
            ))}
          </ul>
        </div>
      </Modal>
    );
  }

  return (
    <FormModal
      title="Importar tarefas (CSV)"
      description="Colunas esperadas no cabeçalho: titulo,descricao,status,responsavel_email,data_limite."
      onClose={onClose}
      onSubmit={handleSubmit}
      submitLabel="Importar"
      savingLabel="Importando…"
      saving={busy}
      submitDisabled={!file}
      error={error}
    >
      <FormField
        label="Arquivo CSV"
        htmlFor="import-file"
        hint="A coluna titulo é obrigatória. Status aceito: pendente, em andamento ou concluída. Linhas inválidas não interrompem a importação: elas voltam com o número da linha."
      >
        {/* O seletor nativo nao tem a altura padrao: o input fica oculto e o Button o aciona. */}
        <input
          ref={fileInputRef}
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setFile(chosen);
            // Arquivo vazio ja avisa ao escolher; o envio continua bloqueado em handleSubmit.
            setError(chosen && chosen.size === 0 ? csvFileProblem(chosen) : null);
          }}
        />
        <div className="flex items-center gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            Escolher arquivo
          </Button>
          <span className="min-w-0 truncate text-body text-slate-600">
            {file ? file.name : 'Nenhum arquivo selecionado'}
          </span>
        </div>
      </FormField>
    </FormModal>
  );
}
