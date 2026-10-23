import { DATE_ONLY_PATTERN } from '../constants/date.constants.js';

/**
 * Data YYYY-MM-DD que existe no calendario (ex.: 2026-02-30 e 2026-13-01 nao existem).
 *
 * Confere por ida e volta em UTC: a data montada precisa devolver o mesmo ano, mes
 * e dia. Evita que uma data impossivel chegue ao Postgres e vire erro 500.
 */
export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}
