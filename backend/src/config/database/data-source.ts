import { DataSource } from 'typeorm';
import { parseDatabaseSslMode, resolveDatabaseSsl } from './database-ssl.js';

/**
 * DataSource usado somente pela CLI do TypeORM (migration:run, migration:revert,
 * migration:show e migration:generate).
 *
 * A CLI roda sobre o codigo COMPILADO em `dist/` (ESM, sem tsx/ts-node), por isso
 * os globs apontam para `dist/**\/*.js`. Assim os mesmos comandos funcionam dentro
 * do container de producao, que tem apenas `dist` e `node_modules` de producao.
 *
 * Execute a partir da pasta `backend` (globs e `.env` sao relativos a ela).
 */

// Carrega o `.env` local, se existir, sem sobrescrever variaveis ja definidas.
// No container nao ha `.env`: a DATABASE_URL vem do ambiente do compose.
try {
  process.loadEnvFile();
} catch {
  // Sem arquivo `.env`: usa apenas as variaveis do ambiente.
}

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: resolveDatabaseSsl(parseDatabaseSslMode(process.env.DATABASE_SSL)),
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  migrationsTableName: 'migrations',
  synchronize: false,
});
