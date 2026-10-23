import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfirmStore } from './confirmStore';
import type { ConfirmOptions } from './confirmStore';

function opcoes(action: ConfirmOptions['action'] = () => Promise.resolve()): ConfirmOptions {
  return {
    title: 'Excluir projeto?',
    description: 'Esta ação não pode ser desfeita.',
    confirmLabel: 'Excluir',
    loadingLabel: 'Excluindo…',
    action,
  };
}

const estado = () => useConfirmStore.getState();

describe('confirmStore (ConfirmDialog, C3)', () => {
  beforeEach(() => {
    estado().dismissed();
  });

  it('abrir mostra o pedido, sem carregamento', () => {
    void estado().open(opcoes());

    expect(estado().request).toMatchObject({ title: 'Excluir projeto?', confirmLabel: 'Excluir' });
    expect(estado().running).toBe(false);
    expect(estado().closing).toBe(false);
  });

  it('cancelar (Esc, fundo, Cancelar: fim da saída) resolve false e não roda a ação', async () => {
    const action = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const resposta = estado().open(opcoes(action));

    estado().dismissed();

    await expect(resposta).resolves.toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(estado().request).toBeNull();
  });

  it('confirmar roda a ação com o botão em carregamento e resolve true; depois toca a saída', async () => {
    let terminar: () => void = () => undefined;
    const action = vi.fn<() => Promise<void>>(() => new Promise<void>((resolve) => (terminar = resolve)));
    const resposta = estado().open(opcoes(action));

    const confirmando = estado().confirm();
    expect(estado().running).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);

    terminar();
    await confirmando;

    await expect(resposta).resolves.toBe(true);
    expect(estado().running).toBe(false);
    expect(estado().closing).toBe(true);
  });

  it('duplo clique em confirmar não roda a ação duas vezes', async () => {
    const action = vi.fn<() => Promise<void>>(() => Promise.resolve());
    void estado().open(opcoes(action));

    await Promise.all([estado().confirm(), estado().confirm()]);

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('falha na ação rejeita com o erro (quem chamou mostra o toast) e fecha o diálogo', async () => {
    const erro = new Error('404');
    const resposta = estado().open(opcoes(() => Promise.reject(erro)));

    await estado().confirm();

    await expect(resposta).rejects.toBe(erro);
    expect(estado().closing).toBe(true);
  });

  it('um pedido novo cancela o anterior ainda aberto', async () => {
    const primeiro = estado().open(opcoes());
    void estado().open({ ...opcoes(), title: 'Remover membro?' });

    await expect(primeiro).resolves.toBe(false);
    expect(estado().request?.title).toBe('Remover membro?');
  });
});
