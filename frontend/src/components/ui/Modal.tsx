import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { AnimationEvent, ComponentProps, MouseEvent, ReactNode } from 'react';
import { motionMs } from '@/utils/motion';
import { Button } from './Button';

export type ModalSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-modal-sm',
  md: 'max-w-modal-md',
  lg: 'max-w-modal-lg',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const FIELDS =
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled])';

/**
 * Modais abertos, do mais antigo ao mais recente. So o do topo responde a Esc e prende o Tab:
 * um dialogo de confirmacao aberto sobre o detalhe da tarefa nao fecha os dois de uma vez.
 */
const openModals: symbol[] = [];

function isTopmost(token: symbol): boolean {
  return openModals[openModals.length - 1] === token;
}

/** Quantos modais travam o scroll ao mesmo tempo (o body so destrava quando zerar). */
let scrollLocks = 0;
let previousOverflow = '';
let previousPaddingRight = '';

function lockBodyScroll() {
  if (scrollLocks === 0) {
    const { body, documentElement } = document;
    previousOverflow = body.style.overflow;
    previousPaddingRight = body.style.paddingRight;

    const scrollbar = window.innerWidth - documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) {
      body.style.paddingRight = `${scrollbar}px`;
    }
  }

  scrollLocks += 1;
}

function unlockBodyScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);

  if (scrollLocks === 0) {
    document.body.style.overflow = previousOverflow;
    document.body.style.paddingRight = previousPaddingRight;
  }
}

const ModalContext = createContext<{ requestClose: () => void } | null>(null);

/**
 * Fecha o modal COM animacao de saida: so depois dela o `onClose` do pai desmonta o modal.
 * Use nos botoes de dentro do modal (Cancelar, Fechar) em vez de chamar `onClose` direto.
 */
export function useModalClose() {
  return useContext(ModalContext)?.requestClose ?? (() => undefined);
}

/** Botao `Cancelar`/`Fechar` do rodape: aciona a saida animada do modal que o contem. */
export function ModalCloseButton({ onClick, ...props }: ComponentProps<typeof Button>) {
  const requestClose = useModalClose();

  return (
    <Button
      {...props}
      onClick={(event) => {
        onClick?.(event);
        requestClose();
      }}
    />
  );
}

type ModalProps = {
  open: boolean;
  /** `alertdialog` para confirmacoes que interrompem o fluxo (ex.: excluir). */
  role?: 'dialog' | 'alertdialog';
  title: string;
  onClose: () => void;
  description?: string;
  /** Id de um texto do corpo que descreve o dialogo (quando nao ha `description`). */
  describedBy?: string;
  size?: ModalSize;
  /** Rodape fixo (Cancelar + acao primaria). */
  footer?: ReactNode;
  /** Quando false, Esc e clique no fundo nao fecham (ex.: enquanto salva). */
  dismissible?: boolean;
  /**
   * Fechamento iniciado pelo pai (ex.: apos salvar): toca a saida e so entao chama `onClose`.
   * Esc, clique no fundo, X e `ModalCloseButton` fazem o mesmo internamente.
   */
  closing?: boolean;
  /** Desligue ao trocar um modal por outro no mesmo lugar (sem repetir a entrada). */
  enterAnimation?: boolean;
  children?: ReactNode;
};

/**
 * Modal acessivel: role=dialog (ou alertdialog), fecha com Esc, clique no fundo ou botao,
 * foco inicial no elemento com `data-autofocus` (senao no primeiro campo, senao no primeiro
 * botao do rodape), foco preso no dialogo e devolvido a quem abriu, e scroll do body travado
 * enquanto aberto. Com modais empilhados, so o do topo reage ao teclado.
 *
 * Tem animacao de entrada (fundo em fade, painel slide-up + scale) e de SAIDA: qualquer pedido de
 * fechamento primeiro toca a saida e o `onClose` do pai (que desmonta o modal) so roda depois dela.
 * Com `prefers-reduced-motion` ambas viram um fade curto.
 */
export function Modal({
  open,
  role = 'dialog',
  title,
  onClose,
  description,
  describedBy,
  size = 'md',
  footer,
  dismissible = true,
  closing: closingProp = false,
  enterAnimation = true,
  children,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);

  const [closingInternal, setClosingInternal] = useState(false);
  const closing = closingInternal || closingProp;
  const closingRef = useRef(false);
  const finishedRef = useRef(false);

  // Refs com o valor mais recente das props, lidos pelos handlers de teclado e pelos timers.
  useLayoutEffect(() => {
    closeRef.current = onClose;
    dismissibleRef.current = dismissible;
    closingRef.current = closing;
  });

  /** Inicia a saida animada (ignorado se ja estiver saindo). */
  const requestClose = useCallback(() => {
    if (!closingRef.current) {
      closingRef.current = true;
      setClosingInternal(true);
    }
  }, []);

  /** Fim da saida: so agora o pai desmonta o modal. */
  const finishClose = useCallback(() => {
    if (!finishedRef.current) {
      finishedRef.current = true;
      closeRef.current();
    }
  }, []);

  // Rede de seguranca: se `animationend` nao disparar, o modal nao fica preso na tela.
  useEffect(() => {
    if (!closing) {
      return;
    }

    const timer = window.setTimeout(finishClose, motionMs('slow') + 100);
    return () => window.clearTimeout(timer);
  }, [closing, finishClose]);

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (closing && event.target === event.currentTarget) {
      finishClose();
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const token = Symbol('modal');
    openModals.push(token);
    lockBodyScroll();

    const panel = panelRef.current;
    const initial =
      panel?.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ??
      bodyRef.current?.querySelector<HTMLElement>(FIELDS) ??
      panel?.querySelector<HTMLElement>('[data-modal-footer] ' + 'button:not([disabled])') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (!isTopmost(token)) {
        return;
      }

      if (event.key === 'Escape') {
        if (dismissibleRef.current && !closingRef.current) {
          event.stopPropagation();
          requestClose();
        }
        return;
      }

      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;

      if (!panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      openModals.splice(openModals.indexOf(token), 1);
      unlockBodyScroll();
      if (opener?.isConnected) {
        opener.focus();
      }
    };
  }, [open, requestClose]);

  if (!open) {
    return null;
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    // So o clique que comeca no fundo fecha: arrastar a selecao de texto para fora nao fecha.
    if (event.target === event.currentTarget && dismissible && !closing) {
      // Evita que o foco va para o body depois de devolvido a quem abriu o modal.
      event.preventDefault();
      requestClose();
    }
  }

  const overlayAnimation = closing ? 'animate-overlay-out' : enterAnimation ? 'animate-overlay-in' : '';
  const dialogAnimation = closing ? 'animate-dialog-out' : enterAnimation ? 'animate-dialog-in' : '';

  return (
    <ModalContext.Provider value={{ requestClose }}>
      <div
        role="presentation"
        onMouseDown={handleBackdropMouseDown}
        data-modal-state={closing ? 'closing' : 'open'}
        className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-compact ${overlayAnimation} ${
          closing ? 'pointer-events-none' : ''
        }`}
      >
        <div
          ref={panelRef}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : describedBy}
          onAnimationEnd={handleAnimationEnd}
          className={`flex max-h-full w-full flex-col rounded-surface border border-slate-200 bg-white shadow-xl ${dialogAnimation} ${SIZES[size]}`}
        >
          <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-card py-4">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-heading font-semibold text-slate-900">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-1 text-body text-slate-600">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              iconOnly
              onClick={requestClose}
              disabled={!dismissible}
              aria-label="Fechar"
              title="Fechar"
            >
              <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </Button>
          </header>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-card py-card">
            {children}
          </div>

          {footer && (
            <footer
              data-modal-footer
              className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-card py-4"
            >
              {footer}
            </footer>
          )}
        </div>
      </div>
    </ModalContext.Provider>
  );
}
