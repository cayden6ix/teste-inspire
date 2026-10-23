import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator.js';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import { bearer, criarProjeto, criarUsuario, url } from '../utils/factories.js';

interface Rota {
  nome: string;
  metodo: 'get' | 'post' | 'patch' | 'put' | 'delete';
  caminho: string;
  publica: boolean;
}

const METODOS_HTTP: Record<number, Rota['metodo']> = {
  [RequestMethod.GET]: 'get',
  [RequestMethod.POST]: 'post',
  [RequestMethod.PATCH]: 'patch',
  [RequestMethod.PUT]: 'put',
  [RequestMethod.DELETE]: 'delete',
};

const juntar = (...partes: Array<string | undefined>) =>
  '/' +
  partes
    .flatMap((parte) => (parte ?? '').split('/'))
    .filter(Boolean)
    .join('/');

/**
 * Lista TODAS as rotas registradas no Nest lendo o contêiner de módulos (controllers,
 * métodos e metadados de @Controller/@Get/@Post... e @Public), sem lista escrita à mão.
 */
function descobrirRotas(testApp: TestApp): Rota[] {
  const reflector = new Reflector();
  const rotas: Rota[] = [];

  for (const modulo of testApp.app.get(ModulesContainer).values()) {
    for (const wrapper of modulo.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller) continue;

      const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
      const prototype = controller.prototype as Record<string, unknown>;

      for (const nome of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[nome];
        if (typeof handler !== 'function') continue;

        const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as
          number | undefined;
        if (metodo === undefined) continue;

        const caminho = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const publica =
          reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
            handler,
            controller,
          ]) === true;

        rotas.push({
          nome: `${controller.name}.${nome}`,
          metodo: METODOS_HTTP[metodo] ?? 'get',
          // Parâmetros de rota (:projectId, :taskId...) viram UUIDs válidos.
          caminho: juntar(base, caminho).replace(/:\w+/g, () => randomUUID()),
          publica,
        });
      }
    }
  }

  return rotas;
}

describe('Segurança e contrato transversal (e2e)', () => {
  let testApp: TestApp;
  let rotas: Rota[];

  beforeAll(async () => {
    testApp = await createTestApp();
    rotas = descobrirRotas(testApp);
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
  });

  const chamar = (rota: Rota, token?: string) => {
    const requisicao = testApp.http()[rota.metodo](url(rota.caminho));
    return token ? requisicao.set(...bearer(token)) : requisicao;
  };

  describe('R29: toda rota protegida exige token', () => {
    it('o inventário de rotas cobre todos os controllers (não passa vazio)', () => {
      expect(rotas.length).toBeGreaterThanOrEqual(21);
      const controllers = new Set(rotas.map((rota) => rota.nome.split('.')[0]));
      expect([...controllers].sort()).toEqual([
        'AuthController',
        'HealthController',
        'ProjectMembersController',
        'ProjectsController',
        'ReportsController',
        'TasksController',
        'UserSearchController',
      ]);
    });

    it('as únicas rotas públicas são register, login e health', () => {
      const publicas = rotas
        .filter((rota) => rota.publica)
        .map((rota) => `${rota.metodo.toUpperCase()} ${rota.caminho}`)
        .sort();

      expect(publicas).toEqual([
        'GET /health',
        'POST /auth/login',
        'POST /auth/register',
      ]);
    });

    it('as rotas públicas respondem sem token (nenhuma devolve 401)', async () => {
      for (const rota of rotas.filter((candidata) => candidata.publica)) {
        const response = await chamar(rota);

        expect(response.status, rota.nome).not.toBe(401);
      }
      expect(
        (await chamar(rotas.find((r) => r.nome === 'HealthController.check')!))
          .status,
      ).toBe(200);
    });

    it('toda rota protegida devolve 401 sem token', async () => {
      const protegidas = rotas.filter((rota) => !rota.publica);

      for (const rota of protegidas) {
        const response = await chamar(rota);

        expect(response.status, `${rota.metodo} ${rota.caminho}`).toBe(401);
        expect(response.body.message, rota.nome).toBe(
          'Você precisa estar autenticado para continuar.',
        );
      }
    });

    it('toda rota protegida devolve 401 com token inválido', async () => {
      const protegidas = rotas.filter((rota) => !rota.publica);

      for (const rota of protegidas) {
        const response = await chamar(rota, 'token.invalido.qualquer');

        expect(response.status, `${rota.metodo} ${rota.caminho}`).toBe(401);
      }
    });

    it('com token válido a mesma rota deixa de devolver 401', async () => {
      const usuario = await criarUsuario(testApp);
      const rota = rotas.find((r) => r.nome === 'ProjectsController.list')!;

      expect((await chamar(rota, usuario.token)).status).toBe(200);
    });
  });

  describe('x-request-id', () => {
    it('devolve o id enviado quando ele tem formato seguro', async () => {
      const response = await testApp
        .http()
        .get(url('/health'))
        .set('x-request-id', 'meu-id_123');

      expect(response.headers['x-request-id']).toBe('meu-id_123');
    });

    it('gera um UUID quando o cliente não envia o cabeçalho', async () => {
      const response = await testApp.http().get(url('/health'));

      expect(response.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it.each([
      'A'.repeat(65),
      'id com espacos',
      '<script>alert(1)</script>',
      'a;b',
    ])('substitui o id inválido %j por um UUID novo', async (invalido) => {
      const response = await testApp
        .http()
        .get(url('/health'))
        .set('x-request-id', invalido);

      const id = response.headers['x-request-id'] as string;
      expect(id).not.toBe(invalido);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('o mesmo id aparece no requestId dos erros', async () => {
      const comId = await testApp
        .http()
        .get(url('/projects'))
        .set('x-request-id', 'correlacao-42');
      const invalido = await testApp
        .http()
        .get(url('/projects'))
        .set('x-request-id', 'a'.repeat(100));

      expect(comId.body.requestId).toBe('correlacao-42');
      expect(invalido.body.requestId).toBe(invalido.headers['x-request-id']);
      expect(invalido.body.requestId).not.toContain('aaaa');
    });
  });

  describe('cabeçalhos HTTP, CORS e Swagger (R38)', () => {
    it('o helmet adiciona os cabeçalhos de segurança padrão', async () => {
      const response = await testApp.http().get(url('/health'));

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('o CORS libera só as origens configuradas, sem credenciais (a API usa Bearer, não cookies)', async () => {
      const permitida = await testApp
        .http()
        .options(url('/projects'))
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');
      const estranha = await testApp
        .http()
        .options(url('/projects'))
        .set('Origin', 'http://site-malicioso.example')
        .set('Access-Control-Request-Method', 'GET');

      expect(permitida.headers['access-control-allow-origin']).toBe(
        'http://localhost:5173',
      );
      expect(
        permitida.headers['access-control-allow-credentials'],
      ).toBeUndefined();
      expect(estranha.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('com SWAGGER_ENABLED=false a documentação não é publicada', async () => {
      expect((await testApp.http().get('/docs-json')).status).toBe(404);
      expect((await testApp.http().get('/docs')).status).toBe(404);
    });
  });

  describe('respostas de erro', () => {
    it('erro 500 nunca vaza SQL, stack ou nomes de tabela', async () => {
      const usuario = await criarUsuario(testApp);
      const projeto = await criarProjeto(testApp, usuario);

      // Derruba a tabela de tarefas só para forçar um erro inesperado de banco (42P01).
      await testApp.dataSource.query(
        'ALTER TABLE tasks RENAME TO tasks_oculta',
      );
      try {
        const response = await testApp
          .http()
          .get(url(`/projects/${projeto.id}/tasks`))
          .set(...bearer(usuario.token));

        expect(response.status).toBe(500);
        expect(response.body.message).toBe(
          'Erro interno do servidor. Tente novamente em instantes.',
        );
        // O path da requisição contém "tasks"; o resto do corpo não pode mencionar o banco.
        const { path: _path, ...semPath } = response.body;
        expect(JSON.stringify(semPath)).not.toMatch(
          /tasks|SELECT|relation|does not exist|at .*\.(js|ts)/i,
        );
      } finally {
        await testApp.dataSource.query(
          'ALTER TABLE tasks_oculta RENAME TO tasks',
        );
      }
    });

    it('o envelope de erro tem sempre o mesmo formato', async () => {
      const response = await testApp.http().get(url('/projects/123'));

      expect(Object.keys(response.body).sort()).toEqual([
        'error',
        'message',
        'path',
        'requestId',
        'statusCode',
        'timestamp',
      ]);
    });
  });
});
