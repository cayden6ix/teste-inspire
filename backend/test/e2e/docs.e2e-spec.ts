import { createTestApp, type TestApp } from '../utils/app.js';

// O ConfigModule valida o ambiente quando o AppModule é importado: este bloco roda antes
// dos imports (vi.hoisted) para LIGAR o Swagger só neste arquivo (o e2e-setup o desliga).
vi.hoisted(() => {
  process.env.SWAGGER_ENABLED = 'true';
});

interface OpenApi {
  info: { title: string };
  paths: Record<
    string,
    Record<string, { tags?: string[]; security?: unknown[] }>
  >;
  components: { securitySchemes?: Record<string, { scheme?: string }> };
}

describe('Documentação OpenAPI (e2e, Swagger ligado)', () => {
  let testApp: TestApp;
  let documento: OpenApi;

  beforeAll(async () => {
    testApp = await createTestApp();
    documento = (await testApp.http().get('/docs-json')).body as OpenApi;
  });

  afterAll(async () => {
    await testApp.close();
  });

  it('serve o JSON do OpenAPI em /docs-json e a interface em /docs', async () => {
    const interfaceHtml = await testApp.http().get('/docs');

    expect(documento.info.title).toBe('API de Gestao de Projetos e Tarefas');
    expect(interfaceHtml.status).toBe(200);
    expect(interfaceHtml.headers['content-type']).toMatch(/text\/html/);
  });

  it('documenta todas as rotas da API sob o prefixo /api', () => {
    const rotas = Object.keys(documento.paths).sort();

    expect(rotas).toEqual(
      expect.arrayContaining([
        '/api/auth/login',
        '/api/auth/register',
        '/api/health',
        '/api/projects',
        '/api/projects/{projectId}',
        '/api/projects/{projectId}/members',
        '/api/projects/{projectId}/members/{userId}',
        '/api/projects/{projectId}/tasks',
        '/api/projects/{projectId}/tasks/{taskId}',
        '/api/projects/{projectId}/tasks/export',
        '/api/projects/{projectId}/tasks/import',
        '/api/reports',
        '/api/users',
      ]),
    );
  });

  it('declara o esquema Bearer JWT', () => {
    expect(documento.components.securitySchemes).toMatchObject({
      bearer: { scheme: 'bearer' },
    });
  });

  it('as rotas protegidas exigem o Bearer; register, login e health não', () => {
    const exigeBearer = (caminho: string, metodo: string) =>
      (documento.paths[caminho]?.[metodo]?.security ?? []).length > 0;

    expect(exigeBearer('/api/projects', 'get')).toBe(true);
    expect(exigeBearer('/api/reports', 'get')).toBe(true);
    expect(exigeBearer('/api/auth/login', 'post')).toBe(false);
    expect(exigeBearer('/api/auth/register', 'post')).toBe(false);
    expect(exigeBearer('/api/health', 'get')).toBe(false);
  });
});
