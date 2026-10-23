import { randomUUID } from 'node:crypto';
import { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  adicionarMembro,
  bearer,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  url,
  type UsuarioCriado,
} from '../utils/factories.js';

describe('Projetos (e2e)', () => {
  let testApp: TestApp;
  let ana: UsuarioCriado;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
    ana = await criarUsuario(testApp, { name: 'Ana' });
  });

  const listar = (usuario: UsuarioCriado, query = '') =>
    testApp
      .http()
      .get(url(`/projects${query}`))
      .set(...bearer(usuario.token));

  describe('POST /projects', () => {
    it('cria o projeto (201) e o criador vira owner', async () => {
      const response = await testApp
        .http()
        .post(url('/projects'))
        .set(...bearer(ana.token))
        .send({
          name: '  Projeto Alpha  ',
          description: 'Descrição do projeto',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Projeto Alpha',
        description: 'Descrição do projeto',
        role: 'owner',
      });
      expect(response.body.id).toEqual(expect.any(String));

      const membros = await testApp
        .http()
        .get(url(`/projects/${response.body.id}/members`))
        .set(...bearer(ana.token));
      expect(membros.body.data).toEqual([
        expect.objectContaining({
          userId: ana.id,
          name: 'Ana',
          email: ana.email,
          role: 'owner',
        }),
      ]);
    });

    it('descrição é opcional e vira null quando vazia', async () => {
      const semDescricao = await criarProjeto(testApp, ana, {
        name: 'Sem descrição',
      });
      const vazia = await criarProjeto(testApp, ana, {
        name: 'Descrição vazia',
        description: '   ',
      });

      expect(semDescricao.description).toBeNull();
      expect(vazia.description).toBeNull();
    });

    it.each([
      {
        corpo: { name: '   ' },
        mensagem: 'O campo "Nome" não pode estar vazio.',
      },
      { corpo: {}, mensagem: 'O campo "Nome" não pode estar vazio.' },
      {
        corpo: { name: 'a'.repeat(130) },
        mensagem: 'O campo "Nome" deve ter no máximo 120 caracteres.',
      },
      {
        corpo: { name: 'Ok', description: 'a'.repeat(2001) },
        mensagem: 'O campo "Descrição" deve ter no máximo 2000 caracteres.',
      },
      {
        corpo: { name: 'Ok', owner: 'x' },
        mensagem: 'O campo "owner" não é permitido.',
      },
    ])(
      'rejeita dados inválidos (400): $mensagem',
      async ({ corpo, mensagem }) => {
        const response = await testApp
          .http()
          .post(url('/projects'))
          .set(...bearer(ana.token))
          .send(corpo);

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual([mensagem]);
      },
    );

    it('sem token devolve 401', async () => {
      const response = await testApp
        .http()
        .post(url('/projects'))
        .send({ name: 'X' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /projects', () => {
    it('devolve o envelope paginado {data, meta} com valores padrão', async () => {
      await criarProjeto(testApp, ana, { name: 'Beta' });
      await criarProjeto(testApp, ana, { name: 'Alfa' });

      const response = await listar(ana);

      expect(response.status).toBe(200);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 15,
        total: 2,
        totalPages: 1,
      });
      expect(response.body.data.map((p: { name: string }) => p.name)).toEqual([
        'Alfa',
        'Beta',
      ]);
      expect(response.body.data[0]).toMatchObject({ role: 'owner' });
    });

    it('lista vazia: total 0 e totalPages 0', async () => {
      const response = await listar(ana);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        data: [],
        meta: { page: 1, limit: 15, total: 0, totalPages: 0 },
      });
    });

    it('lista só os projetos em que o usuário é membro, com o papel dele em cada um', async () => {
      const bruno = await criarUsuario(testApp, { name: 'Bruno' });
      const deAna = await criarProjeto(testApp, ana, { name: 'De Ana' });
      await criarProjeto(testApp, bruno, { name: 'De Bruno' });
      await adicionarMembro(testApp, ana, deAna.id, bruno, ProjectRole.Viewer);

      const doBruno = await listar(bruno);

      expect(
        doBruno.body.data.map((p: { name: string; role: string }) => [
          p.name,
          p.role,
        ]),
      ).toEqual([
        ['De Ana', 'viewer'],
        ['De Bruno', 'owner'],
      ]);
      const daAna = await listar(ana);
      expect(daAna.body.data.map((p: { name: string }) => p.name)).toEqual([
        'De Ana',
      ]);
    });

    it('pagina com page e limit', async () => {
      for (const nome of ['P1', 'P2', 'P3', 'P4', 'P5']) {
        await criarProjeto(testApp, ana, { name: nome });
      }

      const pagina2 = await listar(ana, '?page=2&limit=2');

      expect(pagina2.body.meta).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      });
      expect(pagina2.body.data.map((p: { name: string }) => p.name)).toEqual([
        'P3',
        'P4',
      ]);

      const ultima = await listar(ana, '?page=3&limit=2');
      expect(ultima.body.data.map((p: { name: string }) => p.name)).toEqual([
        'P5',
      ]);

      const alemDoFim = await listar(ana, '?page=4&limit=2');
      expect(alemDoFim.status).toBe(200);
      expect(alemDoFim.body.data).toEqual([]);
      expect(alemDoFim.body.meta.total).toBe(5);
    });

    it('busca em nome e descrição, sem diferenciar maiúsculas', async () => {
      await criarProjeto(testApp, ana, { name: 'Portal do Cliente' });
      await criarProjeto(testApp, ana, {
        name: 'Interno',
        description: 'Migração do PORTAL antigo',
      });
      await criarProjeto(testApp, ana, { name: 'Outro' });

      const response = await listar(ana, '?search=portal');

      expect(response.body.data.map((p: { name: string }) => p.name)).toEqual([
        'Interno',
        'Portal do Cliente',
      ]);
      expect(response.body.meta.total).toBe(2);
    });

    it('trata % e _ da busca como texto literal, não como curingas', async () => {
      await criarProjeto(testApp, ana, { name: 'Meta 100% concluída' });
      await criarProjeto(testApp, ana, { name: 'Meta 1000 itens' });
      await criarProjeto(testApp, ana, { name: 'snake_case' });
      await criarProjeto(testApp, ana, { name: 'snakeXcase' });

      const porcento = await listar(
        ana,
        `?search=${encodeURIComponent('100%')}`,
      );
      const sublinhado = await listar(
        ana,
        `?search=${encodeURIComponent('snake_case')}`,
      );

      expect(porcento.body.data.map((p: { name: string }) => p.name)).toEqual([
        'Meta 100% concluída',
      ]);
      expect(sublinhado.body.data.map((p: { name: string }) => p.name)).toEqual(
        ['snake_case'],
      );
    });

    it('ordena por sortBy e order', async () => {
      await criarProjeto(testApp, ana, { name: 'B' });
      await criarProjeto(testApp, ana, { name: 'A' });
      await criarProjeto(testApp, ana, { name: 'C' });

      const porNomeDesc = await listar(ana, '?sortBy=name&order=desc');
      const maisRecentes = await listar(ana, '?sortBy=createdAt&order=desc');

      expect(
        porNomeDesc.body.data.map((p: { name: string }) => p.name),
      ).toEqual(['C', 'B', 'A']);
      expect(
        maisRecentes.body.data.map((p: { name: string }) => p.name),
      ).toEqual(['C', 'A', 'B']);
    });

    it('a ordenação é determinística entre páginas: sem repetir nem perder projetos com o mesmo nome', async () => {
      const ids: string[] = [];
      for (let i = 0; i < 7; i += 1) {
        ids.push((await criarProjeto(testApp, ana, { name: 'Mesmo nome' })).id);
      }

      const vistos: string[] = [];
      for (const page of [1, 2, 3, 4]) {
        const response = await listar(ana, `?page=${page}&limit=2`);
        vistos.push(...response.body.data.map((p: { id: string }) => p.id));
      }

      expect(vistos).toHaveLength(7);
      expect(new Set(vistos).size).toBe(7);
      expect([...vistos].sort()).toEqual([...ids].sort());
      // Mesma consulta repetida devolve a mesma sequência (desempate por id).
      expect(vistos).toEqual([...ids].sort());
    });

    it.each([
      {
        query: '?limit=101',
        mensagem: 'O campo "Limite" deve ser menor ou igual a 100.',
      },
      {
        query: '?limit=0',
        mensagem: 'O campo "Limite" deve ser maior ou igual a 1.',
      },
      {
        query: '?page=0',
        mensagem: 'O campo "Página" deve ser maior ou igual a 1.',
      },
      {
        query: '?page=abc',
        mensagem: 'O campo "Página" deve ser um número inteiro.',
      },
      {
        query: '?sortBy=password',
        mensagem:
          'O campo "Ordenar por" deve ser um dos valores: name, createdAt, updatedAt.',
      },
      {
        query: '?order=up',
        mensagem: 'O campo "Ordem" deve ser um dos valores: asc, desc.',
      },
    ])('parâmetro inválido $query devolve 400', async ({ query, mensagem }) => {
      const response = await listar(ana, query);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([mensagem]);
    });

    it('aceita limit=100', async () => {
      const response = await listar(ana, '?limit=100');

      expect(response.status).toBe(200);
      expect(response.body.meta.limit).toBe(100);
    });
  });

  describe('GET /projects/:projectId', () => {
    it('detalha o projeto com o papel do usuário', async () => {
      const projeto = await criarProjeto(testApp, ana, {
        name: 'Alpha',
        description: 'Texto',
      });

      const response = await testApp
        .http()
        .get(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: projeto.id,
        name: 'Alpha',
        description: 'Texto',
        role: 'owner',
      });
    });

    it('id que não é UUID devolve 400 em português', async () => {
      const response = await testApp
        .http()
        .get(url('/projects/123'))
        .set(...bearer(ana.token));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'O identificador informado é inválido.',
      );
    });

    it('projeto inexistente devolve 404', async () => {
      const response = await testApp
        .http()
        .get(url(`/projects/${randomUUID()}`))
        .set(...bearer(ana.token));

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Projeto não encontrado.');
    });
  });

  describe('PATCH /projects/:projectId', () => {
    it('atualiza só os campos enviados', async () => {
      const projeto = await criarProjeto(testApp, ana, {
        name: 'Antigo',
        description: 'Original',
      });

      const response = await testApp
        .http()
        .patch(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token))
        .send({ name: 'Novo nome' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: 'Novo nome',
        description: 'Original',
        role: 'owner',
      });
    });

    it('limpa a descrição com null e aceita corpo vazio sem alterar nada', async () => {
      const projeto = await criarProjeto(testApp, ana, {
        name: 'Alpha',
        description: 'Original',
      });

      const limpa = await testApp
        .http()
        .patch(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token))
        .send({ description: null });
      const vazio = await testApp
        .http()
        .patch(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token))
        .send({});

      expect(limpa.status).toBe(200);
      expect(limpa.body.description).toBeNull();
      expect(vazio.status).toBe(200);
      expect(vazio.body).toMatchObject({ name: 'Alpha', description: null });
    });

    it('rejeita nome vazio (400)', async () => {
      const projeto = await criarProjeto(testApp, ana);

      const response = await testApp
        .http()
        .patch(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token))
        .send({ name: '  ' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /projects/:projectId', () => {
    it('o owner exclui (204) e o projeto some', async () => {
      const projeto = await criarProjeto(testApp, ana);

      const exclusao = await testApp
        .http()
        .delete(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token));
      const depois = await testApp
        .http()
        .get(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token));

      expect(exclusao.status).toBe(204);
      expect(exclusao.body).toEqual({});
      expect(depois.status).toBe(404);
    });

    it('a exclusão remove em cascata as tarefas e os vínculos do projeto, e preserva os usuários', async () => {
      const bruno = await criarUsuario(testApp, { name: 'Bruno' });
      const projeto = await criarProjeto(testApp, ana);
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Member,
      );
      await criarTarefa(testApp, ana, projeto.id, { assigneeId: bruno.id });
      await criarTarefa(testApp, ana, projeto.id);

      await testApp
        .http()
        .delete(url(`/projects/${projeto.id}`))
        .set(...bearer(ana.token))
        .expect(204);

      const contar = async (tabela: string) =>
        Number(
          (
            (await testApp.dataSource.query(
              `SELECT count(*) AS n FROM ${tabela}`,
            )) as Array<{ n: string }>
          )[0]?.n,
        );
      expect(await contar('tasks')).toBe(0);
      expect(await contar('project_members')).toBe(0);
      expect(await contar('projects')).toBe(0);
      expect(await contar('users')).toBe(2);
    });
  });
});
