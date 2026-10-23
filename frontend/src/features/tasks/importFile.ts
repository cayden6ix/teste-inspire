export const NO_CSV_FILE_MESSAGE = 'Escolha um arquivo CSV para importar.';

export const EMPTY_CSV_FILE_MESSAGE =
  'O arquivo está vazio. Escolha um CSV com o cabeçalho (titulo,descricao,status,responsavel_email,data_limite) e ao menos uma linha.';

/**
 * Problema do arquivo escolhido para importar, antes de chamar a API (B2-03): nenhum arquivo
 * ou arquivo de 0 bytes. O conteudo (cabecalho, linhas) quem valida e a API (D-030).
 */
export function csvFileProblem(file: Pick<Blob, 'size'> | null): string | null {
  if (!file) {
    return NO_CSV_FILE_MESSAGE;
  }

  return file.size === 0 ? EMPTY_CSV_FILE_MESSAGE : null;
}
