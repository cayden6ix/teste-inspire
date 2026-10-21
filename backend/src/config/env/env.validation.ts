import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Contrato de variaveis de ambiente da aplicacao.
 *
 * Toda variavel usada em runtime passa por esta classe e e validada no boot,
 * de modo que a API nunca sobe com configuracao incompleta ou invalida.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX = 'api';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  DATABASE_SYNCHRONIZE = false;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  DATABASE_LOGGING = false;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN = '1h';

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN = '7d';

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS = 'http://localhost:5173';
}

/**
 * Valida o objeto de variaveis de ambiente e devolve a versao tipada.
 * Lanca no boot se alguma variavel obrigatoria estiver ausente ou invalida.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Configuracao de ambiente invalida: ${details}`);
  }

  return validated;
}
