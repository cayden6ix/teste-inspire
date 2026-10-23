import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  criarUsuario,
  emailUnico,
  SENHA_PADRAO,
  url,
} from '../utils/factories.js';

// O ConfigModule valida o ambiente quando o AppModule é importado: este bloco roda antes
// dos imports (vi.hoisted) para LIGAR o throttler só neste arquivo, com limites pequenos.
// O e2e-setup desliga o rate limit (THROTTLE_DISABLED=true) em todos os outros arquivos.
vi.hoisted(() => {
  process.env.THROTTLE_DISABLED = 'false';
  process.env.THROTTLE_TTL_SECONDS = '3';
  process.env.THROTTLE_LIMIT = '15';
  process.env.THROTTLE_AUTH_LOGIN_LIMIT = '3';
  process.env.THROTTLE_AUTH_REGISTER_LIMIT = '2';
});

const LIMITE_LOGIN = 3;
const LIMITE_CADASTRO = 2;
const LIMITE_GERAL = 15;

const MENSAGEM_429 =
  'Muitas requisições. Aguarde alguns instantes e tente novamente.';

describe('Rate limit (e2e, throttler ligado)', () => {
  let testApp: TestApp;

  // Um app por teste: o contador de requisições fica na memória do app.
  beforeEach(async () => {
    testApp = await createTestApp();
    await limparBanco(testApp.dataSource);
  });

  afterEach(async () => {
    await testApp.close();
  });

  const login = (email: string, password: string) =>
    testApp.http().post(url('/auth/login')).send({ email, password });

  it('o login responde 429 depois de exceder o limite, com Retry-After e mensagem em português', async () => {
    const email = emailUnico('forca-bruta');
    const statusDasTentativas: number[] = [];

    for (let i = 0; i < LIMITE_LOGIN; i += 1) {
      statusDasTentativas.push((await login(email, 'senha-errada')).status);
    }
    const bloqueada = await login(email, 'senha-errada');

    expect(statusDasTentativas).toEqual([401, 401, 401]);
    expect(bloqueada.status).toBe(429);
    expect(bloqueada.body).toMatchObject({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: MENSAGEM_429,
      path: '/api/auth/login',
      requestId: expect.any(String),
    });
    const retryAfter = Number(bloqueada.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(3);
  });

  it('depois do limite, nem a senha correta passa (bloqueio por IP, não por conta)', async () => {
    const usuario = await criarUsuario(testApp);
    for (let i = 0; i < LIMITE_LOGIN; i += 1) {
      await login(usuario.email, 'senha-errada');
    }

    const response = await login(usuario.email, usuario.password);

    expect(response.status).toBe(429);
  });

  it('o limite do login não bloqueia o cadastro', async () => {
    for (let i = 0; i < LIMITE_LOGIN + 1; i += 1) {
      await login(emailUnico(), 'x');
    }

    const cadastro = await testApp
      .http()
      .post(url('/auth/register'))
      .send({ email: emailUnico(), password: SENHA_PADRAO, name: 'Ana' });

    expect(cadastro.status).toBe(201);
  });

  it('o cadastro tem limite próprio: o excedente recebe 429', async () => {
    const status: number[] = [];
    for (let i = 0; i < LIMITE_CADASTRO + 1; i += 1) {
      const response = await testApp
        .http()
        .post(url('/auth/register'))
        .send({
          email: emailUnico(),
          password: SENHA_PADRAO,
          name: `Pessoa ${i}`,
        });
      status.push(response.status);
    }

    expect(status).toEqual([201, 201, 429]);
  });

  it('tentativas com dados inválidos também contam para o limite', async () => {
    const status: number[] = [];
    for (let i = 0; i < LIMITE_CADASTRO + 1; i += 1) {
      status.push(
        (await testApp.http().post(url('/auth/register')).send({})).status,
      );
    }

    expect(status).toEqual([400, 400, 429]);
  });

  it('as demais rotas seguem o limite geral por IP, já antes da autenticação (401 conta)', async () => {
    const status: number[] = [];
    for (let i = 0; i < LIMITE_GERAL + 1; i += 1) {
      status.push((await testApp.http().get(url('/projects'))).status);
    }

    expect(status.slice(0, LIMITE_GERAL).every((s) => s === 401)).toBe(true);
    expect(status[LIMITE_GERAL]).toBe(429);
  });

  it('o 429 sai pelo filtro padrão, com o mesmo envelope dos outros erros', async () => {
    for (let i = 0; i < LIMITE_GERAL; i += 1) {
      await testApp.http().get(url('/projects'));
    }

    const response = await testApp.http().get(url('/projects'));

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({
      statusCode: 429,
      message: MENSAGEM_429,
      path: '/api/projects',
    });
  });

  it('o health (healthcheck do container) não consome o limite', async () => {
    const status: number[] = [];
    for (let i = 0; i < LIMITE_GERAL * 2; i += 1) {
      status.push((await testApp.http().get(url('/health'))).status);
    }

    expect(new Set(status)).toEqual(new Set([200]));
  });

  it('a janela expira: depois do TTL o login volta a responder normalmente', async () => {
    const email = emailUnico();
    for (let i = 0; i < LIMITE_LOGIN + 1; i += 1) {
      await login(email, 'x');
    }
    expect((await login(email, 'x')).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 3200));

    expect((await login(email, 'x')).status).toBe(401);
  });
});
