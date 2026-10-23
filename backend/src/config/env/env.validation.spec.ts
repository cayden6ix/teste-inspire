import {
  DatabaseSslMode,
  NodeEnvironment,
  parseTrustProxy,
  validateEnv,
} from './env.validation.js';

/** O mínimo obrigatório: sem JWT_REFRESH_* (o refresh token não existe mais). */
const ENV_MINIMO = {
  DATABASE_URL: 'postgres://app:app@localhost:5432/app_test',
  JWT_SECRET: 'segredo-de-teste-com-no-minimo-32-caracteres',
};

describe('validateEnv', () => {
  it('aceita só as variáveis obrigatórias e aplica os padrões', () => {
    const env = validateEnv({ ...ENV_MINIMO });

    expect(env).toMatchObject({
      NODE_ENV: NodeEnvironment.Development,
      PORT: 3000,
      API_PREFIX: 'api',
      DATABASE_SSL: DatabaseSslMode.Disabled,
      DATABASE_SYNCHRONIZE: false,
      JWT_EXPIRES_IN: '1h',
      SWAGGER_ENABLED: true,
      TRUST_PROXY: 'false',
      THROTTLE_DISABLED: false,
      THROTTLE_TTL_SECONDS: 60,
      THROTTLE_LIMIT: 100,
      THROTTLE_AUTH_LOGIN_LIMIT: 10,
      THROTTLE_AUTH_REGISTER_LIMIT: 5,
    });
  });

  it('JWT_REFRESH_SECRET e JWT_REFRESH_EXPIRES_IN não são mais exigidos nem expostos', () => {
    const env = validateEnv({ ...ENV_MINIMO });

    expect(env).not.toHaveProperty('JWT_REFRESH_SECRET');
    expect(env).not.toHaveProperty('JWT_REFRESH_EXPIRES_IN');
  });

  it('converte os valores de texto do ambiente para número e booleano', () => {
    const env = validateEnv({
      ...ENV_MINIMO,
      PORT: '4000',
      THROTTLE_DISABLED: 'true',
      THROTTLE_LIMIT: '7',
      SWAGGER_ENABLED: 'false',
      DATABASE_LOGGING: 'true',
    });

    expect(env).toMatchObject({
      PORT: 4000,
      THROTTLE_DISABLED: true,
      THROTTLE_LIMIT: 7,
      SWAGGER_ENABLED: false,
      DATABASE_LOGGING: true,
    });
  });

  it.each([
    {
      variavel: 'DATABASE_URL',
      ambiente: { JWT_SECRET: ENV_MINIMO.JWT_SECRET },
    },
    {
      variavel: 'JWT_SECRET',
      ambiente: { DATABASE_URL: ENV_MINIMO.DATABASE_URL },
    },
  ])('recusa subir sem $variavel', ({ ambiente }) => {
    expect(() => validateEnv(ambiente)).toThrow(
      'Configuração de ambiente inválida',
    );
  });

  it('exige JWT_SECRET com pelo menos 32 caracteres', () => {
    expect(() => validateEnv({ ...ENV_MINIMO, JWT_SECRET: 'curto' })).toThrow(
      /Segredo|JWT_SECRET/,
    );
  });

  it.each(['15m', '1h', '7d', '3600', '30s', '2w'])(
    'aceita JWT_EXPIRES_IN=%s',
    (valor) => {
      expect(
        validateEnv({ ...ENV_MINIMO, JWT_EXPIRES_IN: valor }).JWT_EXPIRES_IN,
      ).toBe(valor);
    },
  );

  it.each(['abc', '1 hora', '-5m', '1h30', ''])(
    'recusa JWT_EXPIRES_IN=%j',
    (valor) => {
      expect(() =>
        validateEnv({ ...ENV_MINIMO, JWT_EXPIRES_IN: valor }),
      ).toThrow('JWT_EXPIRES_IN');
    },
  );

  it.each(['false', 'require', 'verify-full'])(
    'aceita DATABASE_SSL=%s',
    (valor) => {
      expect(
        validateEnv({ ...ENV_MINIMO, DATABASE_SSL: valor }).DATABASE_SSL,
      ).toBe(valor);
    },
  );

  it('recusa DATABASE_SSL desconhecido e NODE_ENV inválido', () => {
    expect(() => validateEnv({ ...ENV_MINIMO, DATABASE_SSL: 'sim' })).toThrow(
      'DATABASE_SSL',
    );
    expect(() => validateEnv({ ...ENV_MINIMO, NODE_ENV: 'staging' })).toThrow(
      'NODE_ENV',
    );
  });

  it.each(['true', 'false', '1', '2'])('aceita TRUST_PROXY=%s', (valor) => {
    expect(validateEnv({ ...ENV_MINIMO, TRUST_PROXY: valor }).TRUST_PROXY).toBe(
      valor,
    );
  });

  it.each(['sim', '-1', '1.5', ''])('recusa TRUST_PROXY=%j', (valor) => {
    expect(() => validateEnv({ ...ENV_MINIMO, TRUST_PROXY: valor })).toThrow(
      'TRUST_PROXY',
    );
  });

  it.each([
    'THROTTLE_LIMIT',
    'THROTTLE_AUTH_LOGIN_LIMIT',
    'THROTTLE_TTL_SECONDS',
  ])('recusa %s zero ou não numérico', (variavel) => {
    expect(() => validateEnv({ ...ENV_MINIMO, [variavel]: '0' })).toThrow(
      'Configuração de ambiente inválida',
    );
    expect(() => validateEnv({ ...ENV_MINIMO, [variavel]: 'muito' })).toThrow(
      'Configuração de ambiente inválida',
    );
  });
});

describe('parseTrustProxy', () => {
  it('converte true/false em booleano e o número de saltos em número', () => {
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('3')).toBe(3);
  });
});
