import { SortOrder } from '../enums/sort-order.enum.js';
import { toPaginatedResponse, toSqlDirection } from './pagination.util.js';

describe('toPaginatedResponse', () => {
  it('devolve totalPages = 0 quando não há registros', () => {
    expect(toPaginatedResponse([], 0, { page: 1, limit: 15 })).toEqual({
      data: [],
      meta: { page: 1, limit: 15, total: 0, totalPages: 0 },
    });
  });

  it.each([
    { total: 1, limit: 15, totalPages: 1 },
    { total: 15, limit: 15, totalPages: 1 },
    { total: 16, limit: 15, totalPages: 2 },
    { total: 100, limit: 10, totalPages: 10 },
    { total: 101, limit: 10, totalPages: 11 },
    { total: 5, limit: 1, totalPages: 5 },
  ])(
    'arredonda para cima: total $total, limit $limit => $totalPages',
    ({ total, limit, totalPages }) => {
      expect(
        toPaginatedResponse([], total, { page: 1, limit }).meta.totalPages,
      ).toBe(totalPages);
    },
  );

  it('preserva os itens e repete page e limit na meta', () => {
    const itens = [{ id: 1 }, { id: 2 }];

    const result = toPaginatedResponse(itens, 42, { page: 3, limit: 2 });

    expect(result.data).toBe(itens);
    expect(result.meta).toMatchObject({ page: 3, limit: 2, total: 42 });
  });
});

describe('toSqlDirection', () => {
  it('converte para o formato do TypeORM', () => {
    expect(toSqlDirection(SortOrder.Asc)).toBe('ASC');
    expect(toSqlDirection(SortOrder.Desc)).toBe('DESC');
  });
});
