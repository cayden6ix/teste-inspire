import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  bearer,
  criarUsuario,
  url,
  type UsuarioCriado,
} from '../utils/factories.js';

const MENSAGEM_TERMO_CURTO =
  'Informe ao menos 3 caracteres no e-mail ou no nome para buscar usuários.';

type Resultado = { id: string; name: string; email: string };

describe('Busca de usuários (e2e)', () => {
  let testApp: TestApp;
  let solicitante: UsuarioCriado;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
    solicitante = await criarUsuario(testApp, {
      name: 'Quem Busca',
      email: 'quem.busca@empresa.com',
    });
    await criarUsuario(testApp, {
      name: 'Ana Souza',
      email: 'ana.souza@empresa.com',
    });
    await criarUsuario(testApp, {
      name: 'Ana Lima',
      email: 'ana.lima@outra.com',
    });
    await criarUsuario(testApp, {
      name: 'Bruno Costa',
      email: 'bruno@empresa.com',
    });
  });

  const buscar = (query: string, usuario = solicitante) =>
    testApp
      .http()
      .get(url(`/users${query}`))
      .set(...bearer(usuario.token));

  describe('R14: exige um termo de busca com ao menos 3 caracteres', () => {
    it.each([
      { nome: 'sem filtro', query: '' },
      { nome: 'só paginação', query: '?page=1&limit=100' },
      { nome: 'nome com 2 caracteres', query: '?name=an' },
      { nome: 'e-mail com 2 caracteres', query: '?email=an' },
      { nome: 'nome só com espaços', query: '?name=%20%20%20%20' },
      {
        nome: 'nome de 3 caracteres que vira 2 depois do trim',
        query: '?name=%20an',
      },
      { nome: 'dois termos curtos', query: '?name=an&email=br' },
    ])('$nome devolve 400 e não lista ninguém', async ({ query }) => {
      const response = await buscar(query);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(MENSAGEM_TERMO_CURTO);
      expect(response.body).not.toHaveProperty('data');
    });

    it('com 3 caracteres no nome devolve 200 paginado, ordenado por nome', async () => {
      const response = await buscar('?name=ana');

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 15,
        total: 2,
        totalPages: 1,
      });
      expect(response.body.data.map((u: Resultado) => u.name)).toEqual([
        'Ana Lima',
        'Ana Souza',
      ]);
    });

    it('com 3 caracteres no e-mail devolve 200 (busca parcial, sem diferenciar maiúsculas)', async () => {
      const response = await buscar('?email=EMPRESA');

      expect(response.status).toBe(200);
      expect(response.body.data.map((u: Resultado) => u.email).sort()).toEqual([
        'ana.souza@empresa.com',
        'bruno@empresa.com',
        'quem.busca@empresa.com',
      ]);
    });

    it('um termo válido basta mesmo que o outro seja curto', async () => {
      const response = await buscar('?name=br&email=bruno');

      expect(response.status).toBe(200);
      expect(response.body.data.map((u: Resultado) => u.name)).toEqual([
        'Bruno Costa',
      ]);
    });

    it('espaços ao redor são descartados antes de contar os caracteres', async () => {
      const response = await buscar('?name=%20%20ana%20%20');

      expect(response.status).toBe(200);
      expect(response.body.meta.total).toBe(2);
    });

    it('% e _ valem como texto, não como curinga: "%%%" não lista todo mundo', async () => {
      const porcentos = await buscar('?name=%25%25%25');
      const sublinhados = await buscar('?name=___');

      expect(porcentos.status).toBe(200);
      expect(porcentos.body.data).toEqual([]);
      expect(sublinhados.body.data).toEqual([]);
    });

    it('pagina o resultado', async () => {
      const pagina1 = await buscar('?email=empresa&limit=2&page=1');
      const pagina2 = await buscar('?email=empresa&limit=2&page=2');

      expect(pagina1.body.meta).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
      expect(pagina1.body.data).toHaveLength(2);
      expect(pagina2.body.data).toHaveLength(1);
      const ids = [...pagina1.body.data, ...pagina2.body.data].map(
        (u: Resultado) => u.id,
      );
      expect(new Set(ids).size).toBe(3);
    });

    it('ordena por e-mail em ordem decrescente', async () => {
      const response = await buscar('?email=empresa&sortBy=email&order=desc');

      expect(response.body.data.map((u: Resultado) => u.email)).toEqual([
        'quem.busca@empresa.com',
        'bruno@empresa.com',
        'ana.souza@empresa.com',
      ]);
    });

    it('sem resultado devolve lista vazia com totalPages 0', async () => {
      const response = await buscar('?name=zzzzz');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, limit: 15, total: 0, totalPages: 0 },
      });
    });
  });

  describe('dados expostos e acesso', () => {
    it('devolve só id, nome e e-mail: nunca senha, status ou datas', async () => {
      const response = await buscar('?name=bruno');

      expect(Object.keys(response.body.data[0]).sort()).toEqual([
        'email',
        'id',
        'name',
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(/password|\$2[aby]\$/);
    });

    it('limit acima de 100 e sortBy fora da lista devolvem 400', async () => {
      expect((await buscar('?name=ana&limit=101')).status).toBe(400);
      expect((await buscar('?name=ana&sortBy=password')).status).toBe(400);
    });

    it('sem token devolve 401', async () => {
      const response = await testApp.http().get(url('/users?name=ana'));

      expect(response.status).toBe(401);
    });
  });
});
