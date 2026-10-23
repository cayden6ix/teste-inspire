import { create } from 'zustand';

export type ConfirmOptions = {
  /** Pergunta curta: "Excluir projeto?". */
  title: string;
  /** O que acontece e com o que (nome do item): "O projeto "X" e todas as suas tarefas...". */
  description: string;
  /** Rotulo da acao destrutiva: "Excluir", "Remover". */
  confirmLabel: string;
  /** Texto de andamento do botao (leitores de tela e `title`): "Excluindo…". */
  loadingLabel: string;
  /** A acao em si (ex.: o DELETE). Roda com o dialogo aberto e o botao em carregamento. */
  action: () => Promise<unknown>;
};

export type ConfirmRequest = ConfirmOptions & { id: number };

type Pending = {
  id: number;
  resolve: (confirmed: boolean) => void;
  reject: (error: unknown) => void;
};

type ConfirmState = {
  request: ConfirmRequest | null;
  /** A acao esta rodando (botao em carregamento; Esc e fundo nao cancelam). */
  running: boolean;
  /** O dialogo esta tocando a animacao de saida. */
  closing: boolean;
  /**
   * Abre o dialogo. A promessa resolve `true` depois que a acao terminou com sucesso, `false`
   * se a pessoa cancelou, e rejeita com o erro da acao (o dialogo fecha; quem chamou mostra o erro).
   */
  open: (options: ConfirmOptions) => Promise<boolean>;
  /** Botao de confirmar: roda a acao. */
  confirm: () => Promise<void>;
  /** Fim da saida animada (Cancelar, Esc, fundo, X ou depois da acao): desmonta o dialogo. */
  dismissed: () => void;
};

let counter = 0;
let pending: Pending | null = null;

/** Resolve a confirmacao em aberto (uma unica vez). */
function settle(id: number, outcome: { confirmed: boolean } | { error: unknown }) {
  if (!pending || pending.id !== id) return;

  const { resolve, reject } = pending;
  pending = null;

  if ('error' in outcome) {
    reject(outcome.error);
  } else {
    resolve(outcome.confirmed);
  }
}

/**
 * Dialogo de confirmacao global (um por vez), no lugar do `window.confirm`. A UI e o
 * `ConfirmDialogHost` montado no App; as telas usam `useConfirm()`.
 */
export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  request: null,
  running: false,
  closing: false,

  open: (options) => {
    // Um pedido novo cancela o anterior que ainda estava aberto.
    if (pending) settle(pending.id, { confirmed: false });

    const id = ++counter;
    set({ request: { ...options, id }, running: false, closing: false });

    return new Promise<boolean>((resolve, reject) => {
      pending = { id, resolve, reject };
    });
  },

  confirm: async () => {
    const { request, running, closing } = get();
    if (!request || running || closing) return;

    set({ running: true });

    try {
      await request.action();
      settle(request.id, { confirmed: true });
    } catch (error) {
      settle(request.id, { error });
    } finally {
      if (get().request?.id === request.id) {
        set({ running: false, closing: true });
      }
    }
  },

  dismissed: () => {
    const { request } = get();
    if (request) settle(request.id, { confirmed: false });
    set({ request: null, running: false, closing: false });
  },
}));

/** `const confirm = useConfirm(); if (await confirm({...})) { ... }` */
export function useConfirm() {
  return useConfirmStore((state) => state.open);
}
