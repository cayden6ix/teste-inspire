import { useMemo, useRef } from 'react';

/**
 * Proteção contra resposta fora de ordem: cada requisição pega um número com `next()` e, ao
 * responder, só atualiza o estado se `isCurrent(id)` ainda for verdadeiro. `cancel()` invalida
 * qualquer requisição em andamento (ex.: quando o recurso deixa de existir).
 */
export function useRequestGuard() {
  const counter = useRef(0);

  return useMemo(
    () => ({
      next: () => ++counter.current,
      isCurrent: (id: number) => id === counter.current,
      cancel: () => {
        counter.current += 1;
      },
    }),
    [],
  );
}
