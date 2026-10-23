/// <reference types="vite/client" />
import { DataSource } from 'typeorm';
import {
  assertTestDatabaseName,
  databaseNameFromUrl,
  resolveTestDatabaseUrl,
} from './test-database.js';

type ModuleExports = Record<string, unknown>;

/** Classes exportadas pelos modulos carregados (o Vite transforma os .ts via SWC). */
function classesOf(modules: Record<string, ModuleExports>): Function[] {
  return Object.values(modules)
    .flatMap((exports) => Object.values(exports))
    .filter((value): value is Function => typeof value === 'function');
}

/** Confere o banco REALMENTE conectado antes de qualquer comando destrutivo. */
async function assertConnectedToTestDatabase(
  dataSource: DataSource,
  expectedName: string,
) {
  const [{ name }] = (await dataSource.query(
    'SELECT current_database() AS name',
  )) as Array<{
    name: string;
  }>;
  assertTestDatabaseName(name);
  if (name !== expectedName) {
    throw new Error(
      `Teste abortado: conectou em "${name}", esperado "${expectedName}".`,
    );
  }
}

/** Chave do advisory lock que serializa as execucoes e2e sobre o mesmo banco de testes. */
const TEST_DATABASE_LOCK_KEY = 7_274_001;

/**
 * Prepara o banco de testes uma vez por execucao: recria o schema e aplica TODAS as
 * migrations a partir dos arquivos de `src` (sem depender do `dist`).
 *
 * Duas execucoes e2e ao mesmo tempo no mesmo banco (ex.: dois desenvolvedores, ou o CI
 * e um terminal) derrubariam o schema uma da outra. Um advisory lock de sessao, mantido
 * ate o fim da execucao, faz a segunda esperar a primeira terminar.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const url = resolveTestDatabaseUrl();
  const expectedName = databaseNameFromUrl(url);

  const lockSource = new DataSource({ type: 'postgres', url });
  await lockSource.initialize();
  const lockRunner = lockSource.createQueryRunner();
  await lockRunner.connect();
  await assertConnectedToTestDatabase(lockSource, expectedName);
  await lockRunner.query('SELECT pg_advisory_lock($1)', [
    TEST_DATABASE_LOCK_KEY,
  ]);

  try {
    await prepareSchema(url, expectedName);
  } catch (error) {
    await lockRunner.release();
    await lockSource.destroy();
    throw error;
  }

  return async () => {
    await lockRunner.query('SELECT pg_advisory_unlock($1)', [
      TEST_DATABASE_LOCK_KEY,
    ]);
    await lockRunner.release();
    await lockSource.destroy();
  };
}

async function prepareSchema(url: string, expectedName: string): Promise<void> {
  // 1) Reset do schema, com uma conexao sem entidades: o driver do TypeORM cria a
  //    extensao uuid-ossp ao conectar quando ha entidades, e o DROP a apagaria.
  const reset = new DataSource({ type: 'postgres', url });
  await reset.initialize();
  try {
    await assertConnectedToTestDatabase(reset, expectedName);
    await reset.query('DROP SCHEMA IF EXISTS public CASCADE');
    await reset.query('CREATE SCHEMA public');
  } finally {
    await reset.destroy();
  }

  // 2) Migrations reais (as mesmas de `npm run migration:run`), lidas de src.
  const migrations = classesOf(
    import.meta.glob<ModuleExports>('../../src/database/migrations/*.ts', {
      eager: true,
    }),
  );
  const entities = classesOf(
    import.meta.glob<ModuleExports>('../../src/**/*.entity.ts', {
      eager: true,
    }),
  );

  const migrator = new DataSource({
    type: 'postgres',
    url,
    entities,
    migrations,
    migrationsTableName: 'migrations',
    synchronize: false,
  });
  await migrator.initialize();
  try {
    await assertConnectedToTestDatabase(migrator, expectedName);
    await migrator.runMigrations({ transaction: 'each' });
  } finally {
    await migrator.destroy();
  }
}
