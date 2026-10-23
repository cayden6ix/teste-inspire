import { randomUUID } from 'node:crypto';
import { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import { TaskStatus } from '../../src/common/enums/task-status.enum.js';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  adicionarMembro,
  bearer,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  url,
  type ProjetoCriado,
  type UsuarioCriado,
} from '../utils/factories.js';

describe('Relatórios (e2e)', () => {
  let testApp: TestApp;
  let ana: UsuarioCriado;
  let bruno: UsuarioCriado;
  let alfa: ProjetoCriado;
  let beta: ProjetoCriado;

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

    // Alfa: 5 tarefas. pendente 2, em_andamento 1, concluida 2.
    // Responsáveis: Ana 3, Bruno 1, sem responsável 1.
    alfa = await criarProjeto(testApp, ana, { name: 'Alfa' });
    await adicionarMembro(testApp, ana, alfa.id, bruno, ProjectRole.Member);
    await criarTarefa(testApp, ana, alfa.id, {
      status: TaskStatus.Pendente,
      assigneeId: ana.id,
    });
    await criarTarefa(testApp, ana, alfa.id, { status: TaskStatus.Pendente });
    await criarTarefa(testApp, ana, alfa.id, {
      status: TaskStatus.EmAndamento,
      assigneeId: bruno.id,
    });
    await criarTarefa(testApp, ana, alfa.id, {
      status: TaskStatus.Concluida,
      assigneeId: ana.id,
    });
    await criarTarefa(testApp, ana, alfa.id, {
      status: TaskStatus.Concluida,
      assigneeId: ana.id,
    });

    // Beta: 2 tarefas, só da Ana (o Bruno não participa).
    beta = await criarProjeto(testApp, ana, { name: 'Beta' });
    await criarTarefa(testApp, ana, beta.id, {
      status: TaskStatus.Concluida,
      assigneeId: ana.id,
    });
    await criarTarefa(testApp, ana, beta.id, { status: TaskStatus.Pendente });
  });

  const relatorio = (usuario: UsuarioCriado, query = '') =>
    testApp
      .http()
      .get(url(`/reports${query}`))
      .set(...bearer(usuario.token));

  describe('por status (padrão)', () => {
    it('soma as tarefas de todos os projetos do usuário', async () => {
      const response = await relatorio(ana);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        groupBy: 'status',
        total: 7,
        byStatus: { pendente: 3, em_andamento: 1, concluida: 3 },
        groups: [
          { key: 'pendente', label: 'Pendente', count: 3 },
          { key: 'em_andamento', label: 'Em andamento', count: 1 },
          { key: 'concluida', label: 'Concluída', count: 3 },
        ],
      });
    });

    it('filtra por projeto', async () => {
      const response = await relatorio(
        ana,
        `?projectId=${alfa.id}&groupBy=status`,
      );

      expect(response.body.total).toBe(5);
      expect(response.body.byStatus).toEqual({
        pendente: 2,
        em_andamento: 1,
        concluida: 2,
      });
    });

    it('conta só os projetos de que o usuário participa', async () => {
      const response = await relatorio(bruno);

      expect(response.body.total).toBe(5);
      expect(response.body.byStatus).toEqual({
        pendente: 2,
        em_andamento: 1,
        concluida: 2,
      });
    });

    it('usuário sem projetos recebe zeros', async () => {
      const novato = await criarUsuario(testApp);

      const response = await relatorio(novato);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        total: 0,
        byStatus: { pendente: 0, em_andamento: 0, concluida: 0 },
      });
    });

    it('os totais batem com a contagem direta no banco', async () => {
      const response = await relatorio(ana);

      const direto = (await testApp.dataSource.query(
        `SELECT status, count(*)::int AS n FROM tasks GROUP BY status`,
      )) as Array<{ status: string; n: number }>;
      const esperado = Object.fromEntries(
        direto.map((linha) => [linha.status, linha.n]),
      );

      expect(response.body.byStatus).toEqual({
        pendente: esperado['pendente'] ?? 0,
        em_andamento: esperado['em_andamento'] ?? 0,
        concluida: esperado['concluida'] ?? 0,
      });
    });
  });

  describe('por usuário', () => {
    it('conta por responsável e inclui "Sem responsável", do maior para o menor', async () => {
      const response = await relatorio(
        ana,
        `?groupBy=user&projectId=${alfa.id}`,
      );

      expect(response.status).toBe(200);
      expect(response.body.groupBy).toBe('user');
      expect(response.body.total).toBe(5);
      expect(response.body.groups).toEqual([
        { key: ana.id, label: 'Ana', count: 3 },
        { key: bruno.id, label: 'Bruno', count: 1 },
        { key: 'sem_responsavel', label: 'Sem responsável', count: 1 },
      ]);
    });

    it('sem filtro de projeto agrega todos os projetos', async () => {
      const response = await relatorio(ana, '?groupBy=user');

      expect(response.body.total).toBe(7);
      expect(response.body.groups).toEqual([
        { key: ana.id, label: 'Ana', count: 4 },
        { key: 'sem_responsavel', label: 'Sem responsável', count: 2 },
        { key: bruno.id, label: 'Bruno', count: 1 },
      ]);
    });

    it('a soma dos grupos é igual ao total', async () => {
      const response = await relatorio(ana, '?groupBy=user');

      const soma = response.body.groups.reduce(
        (acc: number, g: { count: number }) => acc + g.count,
        0,
      );
      expect(soma).toBe(response.body.total);
    });

    it('mantém byStatus preenchido', async () => {
      const response = await relatorio(
        ana,
        `?groupBy=user&projectId=${beta.id}`,
      );

      expect(response.body.byStatus).toEqual({
        pendente: 1,
        em_andamento: 0,
        concluida: 1,
      });
    });
  });

  describe('validação e acesso', () => {
    it('groupBy inválido devolve 400', async () => {
      const response = await relatorio(ana, '?groupBy=mes');

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([
        'O campo "Agrupar por" deve ser um dos valores: status, user.',
      ]);
    });

    it('projectId que não é UUID devolve 400', async () => {
      const response = await relatorio(ana, '?projectId=123');

      expect(response.status).toBe(400);
    });

    it('projeto do qual o usuário não faz parte devolve 404, como um inexistente (D-027)', async () => {
      const response = await relatorio(bruno, `?projectId=${beta.id}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Projeto não encontrado.');
    });

    it('projeto inexistente devolve 404', async () => {
      const response = await relatorio(ana, `?projectId=${randomUUID()}`);

      expect(response.status).toBe(404);
    });

    it('viewer consegue ver o relatório do projeto', async () => {
      const leitor = await criarUsuario(testApp, { name: 'Leitor' });
      await adicionarMembro(testApp, ana, alfa.id, leitor, ProjectRole.Viewer);

      const response = await relatorio(leitor, `?projectId=${alfa.id}`);

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(5);
    });

    it('sem token devolve 401', async () => {
      const response = await testApp.http().get(url('/reports'));

      expect(response.status).toBe(401);
    });
  });
});
