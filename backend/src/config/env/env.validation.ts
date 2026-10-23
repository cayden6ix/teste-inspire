import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { translateValidationErrors } from '../../common/validation/validation-exception.factory.js';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * SSL da conexao com o banco, independente do NODE_ENV:
 * - `false`: sem SSL (Postgres local ou do compose);
 * - `require`: cifra a conexao sem validar o certificado do servidor;
 * - `verify-full`: cifra e valida o certificado (CAs confiaveis do Node).
 */
export enum DatabaseSslMode {
  Disabled = 'false',
  Require = 'require',
  VerifyFull = 'verify-full',
}

/** Segundos (ex.: `3600`) ou duracao com unidade (ex.: `15m`, `1h`, `7d`). */
const JWT_EXPIRES_IN_PATTERN = /^\d+(ms|s|m|h|d|w|y)?$/;

/** `trust proxy` do Express aceito pela API: `true`, `false` ou numero de saltos. */
const TRUST_PROXY_PATTERN = /^(true|false|\d+)$/;

const toBoolean = ({ value }: { value: unknown }) => value === 'true' || value === true;

const toNumber = ({ value }: { value: unknown }) => Number(value);

/**
 * Contrato de variaveis de ambiente da aplicacao.
 *
 * Toda variavel usada em runtime passa por esta classe e e validada no boot,
 * de modo que a API nunca sobe com configuracao incompleta ou invalida.
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  PORT = 3000;

  @IsString()
  @IsNotEmpty()
  API_PREFIX = 'api';

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsEnum(DatabaseSslMode)
  DATABASE_SSL: DatabaseSslMode = DatabaseSslMode.Disabled;

  @Transform(toBoolean)
  @IsBoolean()
  DATABASE_SYNCHRONIZE = false;

  @Transform(toBoolean)
  @IsBoolean()
  DATABASE_LOGGING = false;

  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  @IsString()
  @Matches(JWT_EXPIRES_IN_PATTERN, { context: { format: '15m, 1h, 7d ou número de segundos' } })
  JWT_EXPIRES_IN = '1h';

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS = 'http://localhost:5173';

  /** Publica a documentacao Swagger em `/docs`. */
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED = true;

  /**
   * Atras de um proxy reverso (ex.: nginx do compose), use `1`: o IP real do
   * cliente passa a vir do X-Forwarded-For (usado pelo rate limit).
   */
  @IsString()
  @Matches(TRUST_PROXY_PATTERN, { context: { format: 'true, false ou número de saltos' } })
  TRUST_PROXY = 'false';

  /** Desliga o rate limit (testes automatizados). */
  @Transform(toBoolean)
  @IsBoolean()
  THROTTLE_DISABLED = false;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_SECONDS = 60;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT = 100;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  THROTTLE_AUTH_LOGIN_LIMIT = 10;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  THROTTLE_AUTH_REGISTER_LIMIT = 5;
}

/**
 * Converte o TRUST_PROXY validado no valor aceito pelo `trust proxy` do Express.
 */
export function parseTrustProxy(value: string): boolean | number {
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  return Number(value);
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
    const details = translateValidationErrors(errors).join(' ');
    throw new Error(`Configuração de ambiente inválida: ${details}`);
  }

  return validated;
}
