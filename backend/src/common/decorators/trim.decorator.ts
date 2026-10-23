import { Transform } from 'class-transformer';

interface TrimOptions {
  /** Texto vazio depois do trim vira `null` (campos opcionais que aceitam limpeza). */
  emptyToNull?: boolean;
  /** Texto vazio depois do trim vira `undefined` (filtros de busca opcionais). */
  emptyToUndefined?: boolean;
  /** Converte para minusculas (ex.: e-mail, que e salvo em minusculas). */
  lowercase?: boolean;
}

/**
 * Remove os espacos das bordas de um texto recebido, antes da validacao.
 *
 * Valores que nao sao texto passam sem alteracao, para que o IsString e os demais
 * validadores continuem reportando o tipo errado.
 */
export function Trim(options: TrimOptions = {}): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const text = options.lowercase ? value.trim().toLowerCase() : value.trim();

    if (text === '' && options.emptyToNull) {
      return null;
    }

    if (text === '' && options.emptyToUndefined) {
      return undefined;
    }

    return text;
  });
}
