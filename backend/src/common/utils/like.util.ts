/**
 * Escapa os curingas de LIKE/ILIKE (`%`, `_` e a propria `\`), para que a
 * busca parcial trate o texto digitado como literal.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
