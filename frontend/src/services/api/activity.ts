/**
 * Contador de requisicoes HTTP em andamento (alimenta a barra global de atividade).
 * Store minimo compativel com `useSyncExternalStore`.
 */
let pending = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function requestStarted() {
  pending += 1;
  emit();
}

export function requestFinished() {
  pending = Math.max(0, pending - 1);
  emit();
}

export function subscribePending(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPending() {
  return pending;
}
