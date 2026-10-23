/**
 * Limites do upload de CSV da importacao de tarefas (D-014).
 *
 * Arquivo acima de 5 MB ou com mais de um arquivo e recusado pelo Multer, antes de o
 * handler rodar: 413 para o tamanho e 400 para a quantidade.
 */
export const CSV_UPLOAD_LIMITS = {
  fileSize: 5 * 1024 * 1024,
  files: 1,
};

/**
 * Maximo de linhas de dados (sem o cabecalho) por importacao de CSV. Acima disso a
 * importacao inteira e recusada com 400, antes de gravar qualquer linha.
 */
export const CSV_IMPORT_MAX_ROWS = 5000;
