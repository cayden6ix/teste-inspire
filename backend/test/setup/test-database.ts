/**
 * Banco dos testes e2e.
 *
 * Os testes NUNCA podem tocar o banco de desenvolvimento (app_db): toda URL passa por
 * `assertTestDatabaseUrl`, que aborta se o nome do banco nao terminar em `_test`.
 */

export const DEFAULT_TEST_DATABASE_URL =
  'postgres://app:app@localhost:5432/app_test';

const TEST_DATABASE_SUFFIX = '_test';

/** Nome do banco de uma URL de conexao Postgres (sem a query string). */
export function databaseNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('A URL do banco de testes e invalida (TEST_DATABASE_URL).');
  }
}

/** Aborta se o banco nao for um banco de testes; devolve o proprio nome quando valido. */
export function assertTestDatabaseName(name: string): string {
  if (!name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `Teste abortado: o banco "${name}" nao termina em "${TEST_DATABASE_SUFFIX}". ` +
        'Os testes so podem usar um banco de testes dedicado (ex.: app_test), nunca o app_db.',
    );
  }
  return name;
}

/** Aborta se a URL nao apontar para um banco de testes; devolve a propria URL quando valida. */
export function assertTestDatabaseUrl(url: string): string {
  assertTestDatabaseName(databaseNameFromUrl(url));
  return url;
}

/**
 * URL do banco de testes: `TEST_DATABASE_URL` ou o app_test do compose local.
 * O `DATABASE_URL` do ambiente e do `.env` e ignorado de proposito.
 */
export function resolveTestDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return assertTestDatabaseUrl(
    env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL,
  );
}
