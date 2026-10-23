import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useToastStore } from '@/stores/toastStore';
import type { ToastItem, ToastTone } from '@/stores/toastStore';
import { motionMs } from '@/utils/motion';
import { Button } from './Button';

/** Quantos itens da lista de erros aparecem; o restante vira "e mais N". */
const MAX_ITEMS = 3;

const TONES: Record<ToastTone, string> = {
  success: 'border-emerald-200 text-emerald-700',
  error: 'border-red-200 text-red-700',
  warning: 'border-amber-200 text-amber-700',
  info: 'border-blue-200 text-blue-700',
};

const ICON_PATHS: Record<ToastTone, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 6l12 12M18 6L6 18',
  warning: 'M12 8v5M12 17h.01',
  info: 'M12 11v6M12 7h.01',
};

function ToastIcon({ tone }: { tone: ToastTone }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-1 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATHS[tone]} />
    </svg>
  );
}

type ToastCardProps = {
  toast: ToastItem;
  onRemove: (id: string) => void;
};

/**
 * Um toast: auto-dispensa (4s sucesso, 7s erro), pausa no hover e no foco, botao fechar e
 * animacao de entrada e de saida (so remove do estado depois que a saida termina).
 */
function ToastCard({ toast, onRemove }: ToastCardProps) {
  const { id, tone, title, description, items, duration, revision } = toast;
  const [leaving, setLeaving] = useState(false);
  const remaining = useRef(duration);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const hovered = useRef(false);
  const focused = useRef(false);
  const leavingRef = useRef(false);

  const clearTimer = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  const close = useCallback(() => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    clearTimer();
    setLeaving(true);
  }, [clearTimer]);

  const start = useCallback(() => {
    clearTimer();
    startedAt.current = performance.now();
    timer.current = window.setTimeout(close, remaining.current);
  }, [clearTimer, close]);

  const pause = useCallback(() => {
    if (timer.current === undefined) return;
    clearTimer();
    remaining.current = Math.max(0, remaining.current - (performance.now() - startedAt.current));
  }, [clearTimer]);

  // Toast reaproveitado (mesmo id) ou novo: reinicia o cronometro.
  useEffect(() => {
    remaining.current = duration;
    leavingRef.current = false;
    setLeaving(false);

    if (!hovered.current && !focused.current) {
      start();
    }

    return clearTimer;
  }, [revision, duration, start, clearTimer]);

  // Garante a remocao mesmo se `animationend` nao disparar (aba em segundo plano, por exemplo).
  useEffect(() => {
    if (!leaving) return;
    const fallback = window.setTimeout(() => onRemove(id), motionMs('slow') + 100);
    return () => window.clearTimeout(fallback);
  }, [leaving, id, onRemove]);

  function resume() {
    if (!hovered.current && !focused.current && !leavingRef.current) {
      start();
    }
  }

  const visibleItems = items?.slice(0, MAX_ITEMS) ?? [];
  const hiddenCount = (items?.length ?? 0) - visibleItems.length;

  return (
    <div
      data-toast-tone={tone}
      onMouseEnter={() => {
        hovered.current = true;
        pause();
      }}
      onMouseLeave={() => {
        hovered.current = false;
        resume();
      }}
      onFocus={() => {
        focused.current = true;
        pause();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focused.current = false;
          resume();
        }
      }}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) {
          onRemove(id);
        }
      }}
      className={`pointer-events-auto mt-3 flex items-start gap-3 rounded-surface border bg-white p-compact shadow-lg ${
        TONES[tone]
      } ${leaving ? 'animate-toast-out' : 'animate-toast-in'}`}
    >
      <ToastIcon tone={tone} />
      <div className="min-w-0 flex-1 text-body">
        <p className="font-medium text-slate-900">{title}</p>
        {description && <p className="mt-1 text-slate-600">{description}</p>}
        {visibleItems.length > 0 && (
          <ul className="mt-1 list-disc pl-4 text-slate-600">
            {visibleItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
            {hiddenCount > 0 && <li>{`e mais ${hiddenCount}`}</li>}
          </ul>
        )}
      </div>
      <Button
        variant="ghost"
        iconOnly
        onClick={close}
        aria-label="Fechar notificação"
        title="Fechar notificação"
      >
        <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M5 5l10 10M15 5L5 15" />
        </svg>
      </Button>
    </div>
  );
}

/**
 * Provider de toasts: renderiza o conteudo e, no canto, duas regioes `aria-live` sempre presentes
 * no DOM (condicao para leitores de tela anunciarem): `polite` para sucesso/info e `assertive`
 * para erro/aviso. Use `useToast()` (`stores/toastStore`) para disparar.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const toasts = useToastStore((state) => state.toasts);
  const remove = useToastStore((state) => state.remove);

  const polite = toasts.filter((item) => item.tone === 'success' || item.tone === 'info');
  const assertive = toasts.filter((item) => item.tone === 'error' || item.tone === 'warning');

  return (
    <>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex flex-col sm:left-auto sm:w-modal-sm">
        <div role="status" aria-live="polite" aria-atomic="false" data-toast-region="polite" className="flex flex-col">
          {polite.map((item) => (
            <ToastCard key={item.id} toast={item} onRemove={remove} />
          ))}
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="false" data-toast-region="assertive" className="flex flex-col">
          {assertive.map((item) => (
            <ToastCard key={item.id} toast={item} onRemove={remove} />
          ))}
        </div>
      </div>
    </>
  );
}
