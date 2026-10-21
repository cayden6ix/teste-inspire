import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { NodeEnvironment } from '../env/env.validation.js';

/**
 * Constroi as opcoes do TypeORM a partir do ambiente.
 *
 * FASE 1 (D-002): `synchronize` habilitado em desenvolvimento para criar o
 * schema a partir das entidades. Em producao o `synchronize` e SEMPRE
 * desligado - la, o schema e gerenciado por migrations.
 */
export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  const isProduction = config.get<NodeEnvironment>('NODE_ENV') === NodeEnvironment.Production;
  const synchronize = config.get<boolean>('DATABASE_SYNCHRONIZE', false);

  if (isProduction && synchronize) {
    // FASE 1 (D-002): o schema e criado por `synchronize`. O aviso fica
    // registrado porque, a partir da FASE 2 (migrations), este recurso deve
    // ser desligado em qualquer ambiente compartilhado.
    new Logger('TypeOrmConfig').warn(
      'DATABASE_SYNCHRONIZE=true em producao: o schema sera alterado a partir das entidades. ' +
        'Desative assim que as migrations entrarem (FASE 2).',
    );
  }

  return {
    type: 'postgres',
    url: config.getOrThrow<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize,
    logging: config.get<boolean>('DATABASE_LOGGING', false),
    ssl: isProduction ? { rejectUnauthorized: false } : false,
    poolSize: isProduction ? 20 : 10,
  };
}
