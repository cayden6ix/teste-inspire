import { Logger } from '@nestjs/common';

/**
 * O seed cria contas com senha conhecida (Senha@123): em produção ele só roda com
 * liberação explícita (SEED_ALLOW_PROD=true). O módulo executa `main()` ao ser
 * importado, então o Nest e o AppModule são trocados por dublês.
 */
const createApplicationContext = vi.fn();

vi.mock('@nestjs/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@nestjs/core')>();
  return {
    ...original,
    NestFactory: { createApplicationContext },
  };
});

vi.mock('../../app.module.js', () => ({ AppModule: class AppModule {} }));

const ambienteOriginal = { ...process.env };

async function executarSeed(env: Record<string, string | undefined>) {
  vi.resetModules();
  createApplicationContext.mockReset();
  createApplicationContext.mockResolvedValue({ get: vi.fn(), close: vi.fn() });
  process.exitCode = undefined;

  for (const [chave, valor] of Object.entries(env)) {
    if (valor === undefined) {
      delete process.env[chave];
    } else {
      process.env[chave] = valor;
    }
  }

  await import('./seed.js');
  // O main() é assíncrono e não é exportado: espera as promessas pendentes.
  await vi.waitFor(() => {
    expect(
      createApplicationContext.mock.calls.length > 0 || process.exitCode === 1,
    ).toBe(true);
  });
}

describe('seed: proteção contra uso em produção (R39)', () => {
  let loggerError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = { ...ambienteOriginal };
    process.exitCode = undefined;
    vi.restoreAllMocks();
  });

  it('recusa rodar com NODE_ENV=production sem SEED_ALLOW_PROD', async () => {
    await executarSeed({ NODE_ENV: 'production', SEED_ALLOW_PROD: undefined });

    expect(createApplicationContext).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
    expect(loggerError).toHaveBeenCalledWith(
      'Falha ao executar o seed',
      expect.stringContaining('Seed bloqueado'),
    );
  });

  it.each(['false', '1', 'TRUE', ''])(
    'só o valor exato "true" libera: SEED_ALLOW_PROD=%j continua bloqueado',
    async (valor) => {
      await executarSeed({ NODE_ENV: 'production', SEED_ALLOW_PROD: valor });

      expect(createApplicationContext).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    },
  );

  it('roda em produção quando SEED_ALLOW_PROD=true', async () => {
    await executarSeed({ NODE_ENV: 'production', SEED_ALLOW_PROD: 'true' });

    expect(createApplicationContext).toHaveBeenCalledTimes(1);
  });

  it.each(['development', 'test'])(
    'roda sem liberação extra com NODE_ENV=%s',
    async (nodeEnv) => {
      await executarSeed({ NODE_ENV: nodeEnv, SEED_ALLOW_PROD: undefined });

      expect(createApplicationContext).toHaveBeenCalledTimes(1);
    },
  );
});
