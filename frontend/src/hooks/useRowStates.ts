import { useCallback, useState } from 'react';

export type RowState = 'saving' | 'deleting' | 'removing';

/**
 * Estado por linha de uma listagem (id -> `saving` | `removing`).
 * `saving`: PATCH em andamento (select da linha desabilitado com spinner);
 * `deleting`: DELETE em andamento (botao Excluir/Remover com spinner);
 * `removing`: DELETE concluido, a linha esta tocando a animacao de saida.
 */
export function useRowStates() {
  const [states, setStates] = useState<Record<string, RowState>>({});

  const set = useCallback((id: string, state: RowState) => {
    setStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const clear = useCallback((id: string) => {
    setStates((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const get = useCallback((id: string): RowState | undefined => states[id], [states]);

  return { get, set, clear };
}
