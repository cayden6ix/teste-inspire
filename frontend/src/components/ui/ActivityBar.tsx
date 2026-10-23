import { useEffect, useState, useSyncExternalStore } from 'react';
import { getPending, subscribePending } from '@/services/api/activity';
import { motionMs } from '@/utils/motion';

/**
 * Barra fina e indeterminada no topo enquanto houver requisicoes HTTP em andamento.
 * So aparece depois de `--duration-fast` (150ms) para respostas rapidas nao piscarem, e some com
 * fade ao concluir. `role="progressbar"` sem valor = indeterminada; `aria-busy` reflete o estado.
 */
export function ActivityBar() {
  const pending = useSyncExternalStore(subscribePending, getPending, getPending);
  /** Montada (inclui o fade de saida). */
  const [mounted, setMounted] = useState(false);
  /** Opaca: ha requisicao em andamento e a barra ja esta na tela (o atraso inicial passou). */
  const active = mounted && pending > 0;

  // Entra so depois do atraso inicial e sai so depois do fade: os dois por timer.
  useEffect(() => {
    if (pending > 0 === mounted) {
      return;
    }

    const timer = window.setTimeout(() => setMounted(pending > 0), motionMs('fast'));

    return () => window.clearTimeout(timer);
  }, [pending, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="Carregando…"
      aria-busy={active}
      aria-valuetext="Carregando…"
      className={`pointer-events-none fixed inset-x-0 top-0 z-60 h-activity-bar overflow-hidden bg-slate-900/10 transition-opacity ${
        active ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="h-full w-2/5 animate-progress bg-slate-900" />
    </div>
  );
}
