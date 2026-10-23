import type { DataSource } from 'typeorm';

/**
 * Executa `acao` contando as queries SQL que chegam ao Postgres, trocando
 * temporariamente o logger do TypeORM (o driver chama `logQuery` em toda query).
 *
 * Serve para provar que um fluxo não faz uma query por linha (N+1): o número de
 * queries não pode crescer com o volume de dados.
 */
export async function contarQueries<T>(
  dataSource: DataSource,
  acao: () => Promise<T>,
): Promise<{ resultado: T; queries: string[] }> {
  const queries: string[] = [];
  const mutavel = dataSource as unknown as { logger: unknown };
  const original = mutavel.logger;

  mutavel.logger = {
    logQuery: (query: string) => {
      queries.push(query);
    },
    logQueryError: () => undefined,
    logQuerySlow: () => undefined,
    logSchemaBuild: () => undefined,
    logMigration: () => undefined,
    log: () => undefined,
  };

  try {
    const resultado = await acao();
    return { resultado, queries };
  } finally {
    mutavel.logger = original;
  }
}
