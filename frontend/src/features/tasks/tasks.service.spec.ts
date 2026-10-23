import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn<(url: string, config: { params: { page: number } }) => Promise<unknown>>());

vi.mock('@/services/api/httpClient', () => ({ httpClient: { get } }));

const { BOARD_MAX_PAGES, BOARD_MAX_TASKS, listAllTasks } = await import('./tasks.service');

/** Resposta paginada falsa: `porPagina` tarefas por pagina, `total` no servidor. */
function paginas(total: number, porPagina = 100) {
  const totalPages = Math.ceil(total / porPagina);

  get.mockImplementation((_url: string, { params }: { params: { page: number } }) => {
    const inicio = (params.page - 1) * porPagina;
    const quantos = Math.max(0, Math.min(porPagina, total - inicio));
    return Promise.resolve({
      data: {
        data: Array.from({ length: quantos }, (_, i) => ({ id: `t${inicio + i}` })),
        meta: { page: params.page, limit: porPagina, total, totalPages },
      },
    });
  });
}

describe('listAllTasks: teto do quadro (KAN-15)', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('o teto é de 5.000 tarefas (50 páginas de 100)', () => {
    expect(BOARD_MAX_PAGES).toBe(50);
    expect(BOARD_MAX_TASKS).toBe(5000);
  });

  it('lê todas as páginas quando cabem no teto, com o progresso de cada uma', async () => {
    paginas(250);
    const progresso: Array<[number, number]> = [];

    const resultado = await listAllTasks('p', {}, (pagina, ultima) => progresso.push([pagina, ultima]));

    expect(get).toHaveBeenCalledTimes(3);
    expect(resultado).toMatchObject({ total: 250, truncated: false });
    expect(resultado.tasks).toHaveLength(250);
    expect(progresso).toEqual([
      [2, 3],
      [3, 3],
    ]);
  });

  it('para no teto (50 requisições) e avisa que havia mais', async () => {
    paginas(5047);
    let ultimaInformada = 0;

    const resultado = await listAllTasks('p', {}, (_pagina, ultima) => (ultimaInformada = ultima));

    expect(get).toHaveBeenCalledTimes(50);
    expect(resultado.tasks).toHaveLength(5000);
    expect(resultado).toMatchObject({ total: 5047, truncated: true });
    expect(ultimaInformada).toBe(50);
  });

  it('projeto vazio faz uma requisição só', async () => {
    paginas(0);

    const resultado = await listAllTasks('p');

    expect(get).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ tasks: [], total: 0, truncated: false });
  });

  it('pede 100 por página e repassa os filtros', async () => {
    paginas(1);

    await listAllTasks('proj-1', { assigneeId: 'u1', search: 'login' });

    expect(get).toHaveBeenCalledWith('/projects/proj-1/tasks', {
      params: { assigneeId: 'u1', search: 'login', page: 1, limit: 100 },
    });
  });
});
