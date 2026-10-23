import { useEffect, useId, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import { Modal, ModalCloseButton } from './Modal';
import type { ModalSize } from './Modal';

type FormModalProps = {
  title: string;
  description?: string;
  size?: ModalSize;
  onClose: () => void;
  /** Devolver `true` (sucesso) fecha o modal com a animacao de saida; qualquer outro retorno o mantem aberto. */
  onSubmit: () => void | boolean | Promise<void | boolean>;
  submitLabel: string;
  savingLabel: string;
  saving: boolean;
  submitDisabled?: boolean;
  /** Erro inline: o modal continua aberto. */
  error?: string | null;
  children: ReactNode;
};

/**
 * Modal de formulario padrao: campos no corpo, rodape com Cancelar + acao primaria,
 * estado de carregando e erro dentro do modal. Monte-o so quando for abrir (o estado
 * do formulario nasce e morre com ele).
 */
export function FormModal({
  title,
  description,
  size = 'md',
  onClose,
  onSubmit,
  submitLabel,
  savingLabel,
  saving,
  submitDisabled = false,
  error,
  children,
}: FormModalProps) {
  const formId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [error]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    void (async () => {
      if ((await onSubmit()) === true) {
        setClosing(true);
      }
    })();
  }

  return (
    <Modal
      open
      title={title}
      description={description}
      size={size}
      onClose={onClose}
      dismissible={!saving}
      closing={closing}
      footer={
        <>
          <ModalCloseButton type="button" variant="secondary" disabled={saving}>
            Cancelar
          </ModalCloseButton>
          <Button
            type="submit"
            form={formId}
            loading={saving}
            loadingLabel={savingLabel}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
        {children}
        {error && (
          <div ref={errorRef}>
            <Alert>{error}</Alert>
          </div>
        )}
      </form>
    </Modal>
  );
}
