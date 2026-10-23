import type { DataSource } from 'typeorm';
import { assertTestDatabaseName } from '../setup/test-database.js';

/**
 * Esvazia todas as tabelas de entidades (exceto `migrations`) entre os testes.
 * Confere o nome do banco antes de truncar.
 */
export async function limparBanco(dataSource: DataSource): Promise<void> {
  const [{ name }] = (await dataSource.query(
    'SELECT current_database() AS name',
  )) as Array<{
    name: string;
  }>;
  assertTestDatabaseName(name);

  const tabelas = dataSource.entityMetadatas
    .map((metadata) => `"${metadata.tableName}"`)
    .join(', ');

  await dataSource.query(`TRUNCATE TABLE ${tabelas} RESTART IDENTITY CASCADE`);
}
