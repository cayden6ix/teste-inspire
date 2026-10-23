/**
 * Utilitarios de movimento. As duracoes vem dos tokens `--duration-*` de global.css, para que o JS
 * (timers de saida, atraso da barra de atividade) nunca divirja do CSS.
 */

export type MotionToken = 'fast' | 'base' | 'slow';

const FALLBACK_MS: Record<MotionToken, number> = { fast: 150, base: 200, slow: 300 };

/** Duracao do token de movimento em milissegundos (`--duration-fast|base|slow`). */
export function motionMs(token: MotionToken): number {
  if (typeof document === 'undefined') {
    return FALLBACK_MS[token];
  }

  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--duration-${token}`).trim();
  const value = Number.parseFloat(raw);

  if (Number.isNaN(value)) {
    return FALLBACK_MS[token];
  }

  return raw.endsWith('ms') ? value : value * 1000;
}

/** Espera `ms` milissegundos (usado para deixar a animacao de saida terminar antes de recarregar). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
