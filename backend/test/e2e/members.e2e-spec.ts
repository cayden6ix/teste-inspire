import { randomUUID } from 'node:crypto';
import { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  adicionarMembro,
  bearer,
  criarProjeto,
  criarUsuario,
  url,
  type ProjetoCriado,
  type UsuarioCriado,
} from '../utils/factories.js';

type Membro = { userId: string; name: string; role: string };

describe('Membros do projeto (e2e)', () => {
  let testApp: TestApp;
  let ana: UsuarioCriado;
  let bruno: UsuarioCriado;
  let carla: UsuarioCriado;
  let projeto: ProjetoCriado;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
    ana = await criarUsuario(testApp, { name: 'Ana' });
    bruno = await criarUsuario(testApp, { name: 'Bruno' });
    carla = await criarUsuario(testApp, { name: 'Carla' });
    projeto = await criarProjeto(testApp, ana);
  });

  const membrosUrl = (sufixo = '') =>
    url(`/projects/${projeto.id}/members${sufixo}`);

  const listar = (query = '', usuario = ana) =>
    testApp
      .http()
      .get(membrosUrl(query))
      .set(...bearer(usuario.token));

  describe('POST /projects/:projectId/members', () => {
    it('o owner adiciona um membro (201) e recebe nome, e-mail e papel', async () => {
      const response = await testApp
        .http()
        .post(membrosUrl())
        .set(...bearer(ana.token))
        .send({ userId: bruno.id, role: 'member' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        userId: bruno.id,
        name: 'Bruno',
        email: bruno.email,
        role: 'member',
      });
    });

    it('o membro adicionado passa a ver o projeto na própria listagem', async () => {
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Viewer,
      );

      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer(bruno.token));

      expect(response.body.data).toEqual([
        expect.objectContaining({ id: projeto.id, role: 'viewer' }),
      ]);
    });

    it('adicionar de novo o mesmo usuário devolve 409', async () => {
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Member,
      );

      const response = await testApp
        .http()
        .post(membrosUrl())
        .set(...bearer(ana.token))
        .send({ userId: bruno.id, role: 'viewer' });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Usuário já é membro do projeto.');
    });

    it('usuário inexistente devolve 404', async () => {
      const response = await testApp
        .http()
        .post(membrosUrl())
        .set(...bearer(ana.token))
        .send({ userId: randomUUID(), role: 'member' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Usuário não encontrado.');
    });

    it('dados inválidos devolvem 400 em português', async () => {
      const response = await testApp
        .http()
        .post(membrosUrl())
        .set(...bearer(ana.token))
        .send({ userId: '123', role: 'chefe' });

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'O campo "Usuário" deve ser um identificador válido (UUID).',
        'O campo "Papel" deve ser um dos valores: owner, admin, member, viewer.',
      ]);
    });
  });

  describe('GET /projects/:projectId/members', () => {
    beforeEach(async () => {
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Member,
      );
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        carla,
        ProjectRole.Viewer,
      );
    });

    it('lista paginada ordenada por nome, com o owner incluído', async () => {
      const response = await listar();

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 15,
        total: 3,
        totalPages: 1,
      });
      expect(response.body.data.map((m: Membro) => [m.name, m.role])).toEqual([
        ['Ana', 'owner'],
        ['Bruno', 'member'],
        ['Carla', 'viewer'],
      ]);
    });

    it('filtra por papel', async () => {
      const response = await listar('?role=viewer');

      expect(response.body.data.map((m: Membro) => m.name)).toEqual(['Carla']);
      expect(response.body.meta.total).toBe(1);
    });

    it('pagina', async () => {
      const response = await listar('?limit=2&page=2');

      expect(response.body.data.map((m: Membro) => m.name)).toEqual(['Carla']);
      expect(response.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      });
    });

    it('papel inexistente no filtro e limit 101 devolvem 400', async () => {
      expect((await listar('?role=dono')).status).toBe(400);
      expect((await listar('?limit=101')).status).toBe(400);
    });
  });

  describe('PATCH /projects/:projectId/members/:userId', () => {
    it('o owner altera o papel de um membro', async () => {
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Viewer,
      );

      const response = await testApp
        .http()
        .patch(membrosUrl(`/${bruno.id}`))
        .set(...bearer(ana.token))
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        userId: bruno.id,
        name: 'Bruno',
        role: 'admin',
      });
      const filtro = await listar('?role=admin');
      expect(filtro.body.data.map((m: Membro) => m.name)).toEqual(['Bruno']);
    });

    it('usuário que não é membro devolve 404', async () => {
      const response = await testApp
        .http()
        .patch(membrosUrl(`/${carla.id}`))
        .set(...bearer(ana.token))
        .send({ role: 'viewer' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Membro não encontrado.');
    });

    it('papel inválido devolve 400', async () => {
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Member,
      );

      const response = await testApp
        .http()
        .patch(membrosUrl(`/${bruno.id}`))
        .set(...bearer(ana.token))
        .send({ role: 'rei' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /projects/:projectId/members/:userId', () => {
    it('o owner remove um membro (204) e ele perde o acesso', async () => {
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Member,
      );

      const remocao = await testApp
        .http()
        .delete(membrosUrl(`/${bruno.id}`))
        .set(...bearer(ana.token));
      const acesso = await testApp
        .http()
        .get(url(`/projects/${projeto.id}`))
        .set(...bearer(bruno.token));

      expect(remocao.status).toBe(204);
      expect(acesso.status).toBe(403);
    });

    it('usuário que não é membro devolve 404', async () => {
      const response = await testApp
        .http()
        .delete(membrosUrl(`/${carla.id}`))
        .set(...bearer(ana.token));

      expect(response.status).toBe(404);
    });

    it('o owner não consegue remover a si mesmo (400) e continua no projeto', async () => {
      const response = await testApp
        .http()
        .delete(membrosUrl(`/${ana.id}`))
        .set(...bearer(ana.token));

      expect(response.status).toBe(400);
      expect((await listar()).body.meta.total).toBe(1);
    });
  });
});
