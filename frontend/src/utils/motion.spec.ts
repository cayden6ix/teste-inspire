import { afterEach, describe, expect, it, vi } from 'vitest';
import { delay, motionMs } from './motion';

describe('motionMs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sem DOM (testes, SSR) usa os valores padrão dos tokens', () => {
    expect(motionMs('fast')).toBe(150);
    expect(motionMs('base')).toBe(200);
    expect(motionMs('slow')).toBe(300);
  });

  it('lê o token do CSS em ms ou em s', () => {
    const valores: Record<string, string> = {
      '--duration-fast': ' 120ms ',
      '--duration-slow': '0.25s',
      '--duration-base': 'invalido',
    };
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (nome: string) => valores[nome] ?? '',
    }));

    expect(motionMs('fast')).toBe(120);
    expect(motionMs('slow')).toBe(250);
    expect(motionMs('base')).toBe(200);
  });
});

describe('delay', () => {
  it('resolve depois do tempo pedido', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    let resolvido = false;

    const espera = delay(150).then(() => (resolvido = true));
    await vi.advanceTimersByTimeAsync(149);
    expect(resolvido).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await espera;
    expect(resolvido).toBe(true);

    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});
