import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DatabaseSslMode, NodeEnvironment } from '../env/env.validation.js';
import { resolveDatabaseSsl } from './database-ssl.js';

/**
 * Constroi as opcoes do TypeORM a partir do ambiente.
 *
 * O schema e gerenciado por migrations (D-002, D-018): `synchronize` fica
 * desligado por padrao e as migrations rodam fora do boot da API
 * (`npm run migration:run`; no compose, pelo servico `migrate`).
 * O SSL vem de DATABASE_SSL, e nao do NODE_ENV.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const isProduction = config.get<NodeEnvironment>('NODE_ENV') === NodeEnvironment.Production;

  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: config.get<boolean>('DATABASE_SYNCHRONIZE', false),
    logging: config.get<boolean>('DATABASE_LOGGING', false),
    ssl: resolveDatabaseSsl(config.get<DatabaseSslMode>('DATABASE_SSL', DatabaseSslMode.Disabled)),
    poolSize: isProduction ? 20 : 10,
  };
}
