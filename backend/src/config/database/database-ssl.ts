import type { TlsOptions } from 'node:tls';
import { DatabaseSslMode } from '../env/env.validation.js';

/**
 * Opcao `ssl` do driver `pg` a partir de DATABASE_SSL (independente do NODE_ENV).
 *
 * Usada pela API (`typeorm.config.ts`) e pela CLI de migrations (`data-source.ts`),
 * para as duas conexoes terem sempre a mesma politica de SSL.
 */
export function resolveDatabaseSsl(mode: DatabaseSslMode): false | TlsOptions {
  switch (mode) {
    case DatabaseSslMode.Require:
      return { rejectUnauthorized: false };
    case DatabaseSslMode.VerifyFull:
      return { rejectUnauthorized: true };
    default:
      return false;
  }
}

/**
 * Le DATABASE_SSL fora do ConfigModule (CLI do TypeORM). Valor invalido falha
 * em vez de cair silenciosamente para "sem SSL".
 */
export function parseDatabaseSslMode(value: string | undefined): DatabaseSslMode {
  const mode = value ?? DatabaseSslMode.Disabled;
  const valid = Object.values(DatabaseSslMode) as string[];

  if (!valid.includes(mode)) {
    throw new Error(
      `Configuração de ambiente inválida: DATABASE_SSL deve ser um dos valores: ${valid.join(', ')}.`,
    );
  }

  return mode as DatabaseSslMode;
}
