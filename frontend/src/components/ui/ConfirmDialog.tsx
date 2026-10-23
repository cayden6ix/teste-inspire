import { useId } from 'react';
import { useConfirmStore } from '@/stores/confirmStore';
import { Button } from './Button';
import { Modal, ModalCloseButton } from './Modal';

/**
 * Dialogo de confirmacao de acoes destrutivas (no lugar do `window.confirm`), montado uma vez
 * no App. Construido sobre o `Modal`: `role="alertdialog"`, foco inicial em Cancelar, Esc e
 * clique no fundo cancelam, e a acao roda com o botao em carregamento (mesma largura) e o
 * dialogo travado. Abra com `useConfirm()` (stores/confirmStore).
 */
export function ConfirmDialogHost() {
  const request = useConfirmStore((state) => state.request);
  const running = useConfirmStore((state) => state.running);
  const closing = useConfirmStore((state) => state.closing);
  const confirm = useConfirmStore((state) => state.confirm);
  const dismissed = useConfirmStore((state) => state.dismissed);
  const descriptionId = useId();

  if (!request) {
    return null;
  }

  return (
    <Modal
      key={request.id}
      open
      role="alertdialog"
      size="sm"
      title={request.title}
      describedBy={descriptionId}
      onClose={dismissed}
      dismissible={!running}
      closing={closing}
      footer={
        <>
          <ModalCloseButton variant="secondary" disabled={running} data-autofocus>
            Cancelar
          </ModalCloseButton>
          <Button
            variant="danger"
            loading={running}
            loadingLabel={request.loadingLabel}
            disabled={closing}
            onClick={() => void confirm()}
          >
            {request.confirmLabel}
          </Button>
        </>
      }
    >
      <p id={descriptionId} className="text-body text-slate-700">
        {request.description}
      </p>
    </Modal>
  );
}
