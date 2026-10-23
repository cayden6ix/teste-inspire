import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export type ToastInput = {
  /** Mesmo `id` substitui o toast existente (e reinicia o tempo) em vez de empilhar outro. */
  id?: string;
  title: string;
  description?: string;
  /** Lista curta (ex.: erros de validacao da API). */
  items?: string[];
};

export type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
  /** Duracao ate dispensar sozinho (ms). */
  duration: number;
  /** Sobe quando o toast e reaproveitado: reinicia o cronometro. */
  revision: number;
};

/** Sucesso e informacao somem em ~4s; erro e aviso ficam ~7s (mais tempo para ler). */
const DURATIONS: Record<ToastTone, number> = {
  success: 4000,
  info: 4000,
  warning: 7000,
  error: 7000,
};

const MAX_TOASTS = 5;

type ToastState = {
  toasts: ToastItem[];
  push: (tone: ToastTone, input: ToastInput) => string;
  remove: (id: string) => void;
};

let counter = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (tone, input) => {
    const id = input.id ?? `toast-${++counter}`;

    set((state) => {
      const existing = state.toasts.find((item) => item.id === id);
      const next: ToastItem = {
        ...input,
        id,
        tone,
        duration: DURATIONS[tone],
        revision: (existing?.revision ?? 0) + 1,
      };

      if (existing) {
        return { toasts: state.toasts.map((item) => (item.id === id ? next : item)) };
      }

      return { toasts: [...state.toasts, next].slice(-MAX_TOASTS) };
    });

    return id;
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
}));

function normalize(input: string | ToastInput): ToastInput {
  return typeof input === 'string' ? { title: input } : input;
}

/** API de toasts utilizavel fora do React (interceptors do httpClient). */
export const toast = {
  success: (input: string | ToastInput) => useToastStore.getState().push('success', normalize(input)),
  error: (input: string | ToastInput) => useToastStore.getState().push('error', normalize(input)),
  info: (input: string | ToastInput) => useToastStore.getState().push('info', normalize(input)),
  warning: (input: string | ToastInput) => useToastStore.getState().push('warning', normalize(input)),
  dismiss: (id: string) => useToastStore.getState().remove(id),
};

/** Hook de toasts: `const toast = useToast(); toast.success('Projeto criado.')`. */
export function useToast() {
  return toast;
}
