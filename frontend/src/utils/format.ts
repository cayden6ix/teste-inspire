/**
 * Formatacao para exibicao em pt-BR. So mexe no que o usuario ve: o valor enviado a API
 * (datas em AAAA-MM-DD) continua o mesmo.
 */

/** Data AAAA-MM-DD (ou ISO) para dd/mm/aaaa. Cria a data no fuso local para nao voltar um dia. */
export function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
}

/** Numero com separador de milhar pt-BR (1000 -> 1.000). */
export function formatNumber(value: number): string {
  return value.toLocaleString('pt-BR');
}

/**
 * Percentual inteiro de `part` em `total` para exibicao (REL-08): `0%` so quando e zero de
 * fato; qualquer valor acima de zero e abaixo de 1% aparece como `<1%` (e nao `0%`).
 */
export function formatPercent(part: number, total: number): string {
  if (total <= 0 || part <= 0) {
    return '0%';
  }

  const percent = (part / total) * 100;

  return percent < 1 ? '<1%' : `${Math.round(percent)}%`;
}
