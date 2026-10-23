import { IsOptional } from 'class-validator';
import { validarDto } from '../../../test/utils/validation.js';
import { IsDateOnly } from '../decorators/is-date-only.decorator.js';
import { isValidDateOnly } from './date.util.js';

describe('isValidDateOnly', () => {
  it.each([
    '2026-01-01',
    '2026-12-31',
    '2028-02-29',
    '2026-02-28',
    '2000-02-29',
    '2026-04-30',
  ])('aceita a data real %s', (data) => {
    expect(isValidDateOnly(data)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2100-02-29',
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-01-32',
  ])('recusa a data impossível %s (iria virar 500 no Postgres)', (data) => {
    expect(isValidDateOnly(data)).toBe(false);
  });

  it.each([
    '2026-1-1',
    '26-01-01',
    '2026/01/01',
    '01/01/2026',
    '2026-01-01T10:00:00Z',
    '2026-01-01 ',
    ' 2026-01-01',
    'amanhã',
    '',
  ])('recusa o formato %j', (valor) => {
    expect(isValidDateOnly(valor)).toBe(false);
  });
});

describe('@IsDateOnly', () => {
  class Amostra {
    @IsOptional()
    @IsDateOnly()
    data?: string | null;
  }

  it('aceita data real, ausente e nula', async () => {
    expect((await validarDto(Amostra, { data: '2026-05-10' })).valido).toBe(
      true,
    );
    expect((await validarDto(Amostra, {})).valido).toBe(true);
    expect((await validarDto(Amostra, { data: null })).valido).toBe(true);
  });

  it('data impossível gera uma única mensagem de campo inválido', async () => {
    const result = await validarDto(Amostra, { data: '2026-02-30' });

    expect(result.valido).toBe(false);
    expect(result.mensagens).toHaveLength(1);
    expect(result.mensagens[0]).toContain('"data"');
  });

  it.each(['2026/01/01', '2026-01-01T10:00:00Z', 'amanhã', '31/12/2026'])(
    'formato fora do padrão %j é recusado com uma única mensagem',
    async (valor) => {
      const result = await validarDto(Amostra, { data: valor });

      expect(result.valido).toBe(false);
      expect(result.mensagens).toHaveLength(1);
    },
  );
});
