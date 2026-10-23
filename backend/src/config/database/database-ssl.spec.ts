import { ConfigService } from '@nestjs/config';
import { DatabaseSslMode } from '../env/env.validation.js';
import { parseDatabaseSslMode, resolveDatabaseSsl } from './database-ssl.js';
import { buildTypeOrmOptions } from './typeorm.config.js';

describe('resolveDatabaseSsl (R17)', () => {
  it('false: sem SSL', () => {
    expect(resolveDatabaseSsl(DatabaseSslMode.Disabled)).toBe(false);
  });

  it('require: cifra sem validar o certificado', () => {
    expect(resolveDatabaseSsl(DatabaseSslMode.Require)).toEqual({
      rejectUnauthorized: false,
    });
  });

  it('verify-full: cifra e valida o certificado do servidor', () => {
    expect(resolveDatabaseSsl(DatabaseSslMode.VerifyFull)).toEqual({
      rejectUnauthorized: true,
    });
  });
});

describe('parseDatabaseSslMode', () => {
  it('sem valor usa false', () => {
    expect(parseDatabaseSslMode(undefined)).toBe(DatabaseSslMode.Disabled);
  });

  it.each(['false', 'require', 'verify-full'])('aceita %s', (valor) => {
    expect(parseDatabaseSslMode(valor)).toBe(valor);
  });

  it('valor inválido falha em vez de cair silenciosamente para "sem SSL"', () => {
    expect(() => parseDatabaseSslMode('true')).toThrow('DATABASE_SSL');
  });
});

describe('buildTypeOrmOptions', () => {
  const config = (valores: Record<string, unknown>) =>
    ({
      get: (chave: string, padrao?: unknown) => valores[chave] ?? padrao,
      getOrThrow: (chave: string) => valores[chave],
    }) as unknown as ConfigService;

  it('o SSL vem de DATABASE_SSL, e não do NODE_ENV', () => {
    const producaoSemSsl = buildTypeOrmOptions(
      config({
        DATABASE_URL: 'postgres://x',
        NODE_ENV: 'production',
        DATABASE_SSL: 'false',
      }),
    );
    const devComSsl = buildTypeOrmOptions(
      config({
        DATABASE_URL: 'postgres://x',
        NODE_ENV: 'development',
        DATABASE_SSL: 'verify-full',
      }),
    );

    expect(producaoSemSsl).toMatchObject({ ssl: false });
    expect(devComSsl).toMatchObject({ ssl: { rejectUnauthorized: true } });
  });

  it('nunca liga synchronize por padrão e usa o pool maior em produção', () => {
    const producao = buildTypeOrmOptions(
      config({ DATABASE_URL: 'postgres://x', NODE_ENV: 'production' }),
    );
    const dev = buildTypeOrmOptions(
      config({ DATABASE_URL: 'postgres://x', NODE_ENV: 'development' }),
    );

    expect(producao).toMatchObject({ synchronize: false, poolSize: 20 });
    expect(dev).toMatchObject({ synchronize: false, poolSize: 10 });
  });
});
