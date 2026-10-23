import { plainToInstance } from 'class-transformer';
import { Trim } from './trim.decorator.js';

class Amostra {
  @Trim()
  simples?: unknown;

  @Trim({ emptyToNull: true })
  paraNulo?: unknown;

  @Trim({ emptyToUndefined: true })
  paraIndefinido?: unknown;

  @Trim({ lowercase: true })
  minusculo?: unknown;
}

const transformar = (plain: Record<string, unknown>) =>
  plainToInstance(Amostra, plain);

describe('Trim', () => {
  it('remove espaços das bordas e mantém os do meio', () => {
    expect(transformar({ simples: '  Projeto   Alpha \n' }).simples).toBe(
      'Projeto   Alpha',
    );
  });

  it('mantém texto só com espaços como vazio por padrão', () => {
    expect(transformar({ simples: '   ' }).simples).toBe('');
  });

  it('emptyToNull converte texto vazio em null, mas preserva texto preenchido', () => {
    expect(transformar({ paraNulo: '   ' }).paraNulo).toBeNull();
    expect(transformar({ paraNulo: '' }).paraNulo).toBeNull();
    expect(transformar({ paraNulo: ' ok ' }).paraNulo).toBe('ok');
  });

  it('emptyToUndefined converte texto vazio em undefined', () => {
    expect(
      transformar({ paraIndefinido: '  ' }).paraIndefinido,
    ).toBeUndefined();
    expect(transformar({ paraIndefinido: ' a ' }).paraIndefinido).toBe('a');
  });

  it('lowercase aplica trim e converte para minúsculas', () => {
    expect(
      transformar({ minusculo: '  Ana.Souza@Empresa.COM ' }).minusculo,
    ).toBe('ana.souza@empresa.com');
  });

  it.each([123, true, null, ['a'], { a: 1 }])(
    'não mexe em valores que não são texto (%j), para o IsString reportar o tipo',
    (valor) => {
      const resultado = transformar({
        simples: valor,
        paraNulo: valor,
        paraIndefinido: valor,
        minusculo: valor,
      });

      expect(resultado.simples).toEqual(valor);
      expect(resultado.paraNulo).toEqual(valor);
      expect(resultado.paraIndefinido).toEqual(valor);
      expect(resultado.minusculo).toEqual(valor);
    },
  );
});
