import { randomUUID } from 'node:crypto';
import { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import { TaskStatus } from '../../src/common/enums/task-status.enum.js';
import { ProjectsRepository } from '../../src/modules/projects/repositories/projects.repository.js';
import { createTestApp, type TestApp } from '../utils/app.js';
import { limparBanco } from '../utils/database.js';
import {
  adicionarMembro,
  bearer,
  criarProjeto,
  criarTarefa,
  criarUsuario,
  emailUnico,
  SENHA_PADRAO,
  url,
  type UsuarioCriado,
} from '../utils/factories.js';
import { contarQueries } from '../utils/queries.js';

const contar = async (testApp: TestApp, sql: string, params: unknown[] = []) =>
  Number(
    ((await testApp.dataSource.query(sql, params)) as Array<{ n: string }>)[0]
      ?.n,
  );

/**
 * Consistência sob falha e concorrência: transações (R10), violações de unicidade em
 * corrida (R11), agregação no banco (R12) e desatribuição ao remover membro (R13).
 */
describe('Consistência de dados (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
  });

  describe('R10: criar projeto e owner são atômicos', () => {
    it('se o vínculo do owner falha, o projeto também é desfeito (nenhum projeto órfão)', async () => {
      const repositorio = testApp.app.get(ProjectsRepository);

      // O segundo passo (INSERT em project_members) viola a FK de user_id.
      await expect(
        repositorio.createWithOwner(
          { name: 'Projeto órfão', description: null },
          randomUUID(),
        ),
      ).rejects.toThrow();

      expect(await contar(testApp, 'SELECT count(*) AS n FROM projects')).toBe(
        0,
      );
      expect(
        await contar(testApp, 'SELECT count(*) AS n FROM project_members'),
      ).toBe(0);
    });

    it('no caminho feliz grava projeto e owner juntos', async () => {
      const ana = await criarUsuario(testApp);

      const projeto = await criarProjeto(testApp, ana, { name: 'Íntegro' });

      expect(
        await contar(
          testApp,
          `SELECT count(*) AS n FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = 'owner'`,
          [projeto.id, ana.id],
        ),
      ).toBe(1);
    });
  });

  describe('R11: unicidade sob concorrência vira 409, não 500', () => {
    it.each([1, 2, 3, 4, 5])(
      'cadastros simultâneos do mesmo e-mail (rodada %i): um 201 e um 409',
      async () => {
        const email = emailUnico('corrida');
        const cadastrar = () =>
          testApp.http().post(url('/auth/register')).send({
            email,
            password: SENHA_PADRAO,
            name: 'Corrida',
          });

        const respostas = await Promise.all([cadastrar(), cadastrar()]);

        expect(respostas.map((r) => r.status).sort((a, b) => a - b)).toEqual([
          201, 409,
        ]);
        const conflito = respostas.find((r) => r.status === 409)!;
        expect(conflito.body.message).toBe('Este e-mail já está cadastrado.');
        expect(
          await contar(
            testApp,
            'SELECT count(*) AS n FROM users WHERE email = $1',
            [email],
          ),
        ).toBe(1);
      },
    );

    it('muitos cadastros simultâneos do mesmo e-mail: exatamente um 201, todos os outros 409', async () => {
      const email = emailUnico('multidao');

      const respostas = await Promise.all(
        Array.from({ length: 6 }, () =>
          testApp
            .http()
            .post(url('/auth/register'))
            .send({ email, password: SENHA_PADRAO, name: 'Multidão' }),
        ),
      );

      const status = respostas.map((r) => r.status);
      expect(status.filter((s) => s === 201)).toHaveLength(1);
      expect(status.filter((s) => s === 409)).toHaveLength(5);
      expect(status.some((s) => s >= 500)).toBe(false);
    });

    it('adições simultâneas do mesmo membro: um 201 e um 409 "Usuário já é membro do projeto."', async () => {
      const ana = await criarUsuario(testApp);
      const bruno = await criarUsuario(testApp);
      const projeto = await criarProjeto(testApp, ana);
      const adicionar = () =>
        testApp
          .http()
          .post(url(`/projects/${projeto.id}/members`))
          .set(...bearer(ana.token))
          .send({ userId: bruno.id, role: 'member' });

      const respostas = await Promise.all([
        adicionar(),
        adicionar(),
        adicionar(),
      ]);

      expect(respostas.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409, 409,
      ]);
      expect(respostas.find((r) => r.status === 409)!.body.message).toBe(
        'Usuário já é membro do projeto.',
      );
      expect(
        await contar(
          testApp,
          'SELECT count(*) AS n FROM project_members WHERE project_id = $1 AND user_id = $2',
          [projeto.id, bruno.id],
        ),
      ).toBe(1);
    });
  });

  describe('R13: remover membro desatribui as tarefas dele', () => {
    let ana: UsuarioCriado;
    let bruno: UsuarioCriado;

    beforeEach(async () => {
      ana = await criarUsuario(testApp, { name: 'Ana' });
      bruno = await criarUsuario(testApp, { name: 'Bruno' });
    });

    it('as tarefas do ex-membro ficam sem responsável, e as de outros projetos ficam intactas', async () => {
      const alfa = await criarProjeto(testApp, ana, { name: 'Alfa' });
      const beta = await criarProjeto(testApp, ana, { name: 'Beta' });
      await adicionarMembro(testApp, ana, alfa.id, bruno, ProjectRole.Member);
      await adicionarMembro(testApp, ana, beta.id, bruno, ProjectRole.Member);
      const t1 = await criarTarefa(testApp, ana, alfa.id, {
        assigneeId: bruno.id,
      });
      const t2 = await criarTarefa(testApp, ana, alfa.id, {
        assigneeId: bruno.id,
      });
      const daAna = await criarTarefa(testApp, ana, alfa.id, {
        assigneeId: ana.id,
      });
      const noBeta = await criarTarefa(testApp, ana, beta.id, {
        assigneeId: bruno.id,
      });

      const remocao = await testApp
        .http()
        .delete(url(`/projects/${alfa.id}/members/${bruno.id}`))
        .set(...bearer(ana.token));

      expect(remocao.status).toBe(204);
      const responsaveis = (await testApp.dataSource.query(
        'SELECT id, assignee_id FROM tasks',
      )) as Array<{ id: string; assignee_id: string | null }>;
      const porId = new Map(responsaveis.map((t) => [t.id, t.assignee_id]));
      expect(porId.get(t1.id)).toBeNull();
      expect(porId.get(t2.id)).toBeNull();
      expect(porId.get(daAna.id)).toBe(ana.id);
      expect(porId.get(noBeta.id)).toBe(bruno.id);
      expect(porId.size).toBe(4);
    });

    it('a tarefa continua existindo e pode ser editada normalmente depois da remoção', async () => {
      const projeto = await criarProjeto(testApp, ana);
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Member,
      );
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        title: 'Era do Bruno',
        assigneeId: bruno.id,
      });
      await testApp
        .http()
        .delete(url(`/projects/${projeto.id}/members/${bruno.id}`))
        .set(...bearer(ana.token))
        .expect(204);

      const detalhe = await testApp
        .http()
        .get(url(`/projects/${projeto.id}/tasks/${tarefa.id}`))
        .set(...bearer(ana.token));
      const edicao = await testApp
        .http()
        .patch(url(`/projects/${projeto.id}/tasks/${tarefa.id}`))
        .set(...bearer(ana.token))
        .send({ status: TaskStatus.Concluida });

      expect(detalhe.body).toMatchObject({
        title: 'Era do Bruno',
        assigneeId: null,
        assigneeName: null,
      });
      expect(edicao.status).toBe(200);
      expect(edicao.body.status).toBe('concluida');
    });

    it('remover um membro sem tarefas funciona', async () => {
      const projeto = await criarProjeto(testApp, ana);
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        bruno,
        ProjectRole.Viewer,
      );

      const remocao = await testApp
        .http()
        .delete(url(`/projects/${projeto.id}/members/${bruno.id}`))
        .set(...bearer(ana.token));

      expect(remocao.status).toBe(204);
    });

    it('remoção negada (403) não desatribui nada', async () => {
      const projeto = await criarProjeto(testApp, ana);
      const admin = await criarUsuario(testApp, { name: 'Admin' });
      await adicionarMembro(testApp, ana, projeto.id, admin, ProjectRole.Admin);
      await adicionarMembro(testApp, ana, projeto.id, bruno, ProjectRole.Admin);
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        assigneeId: bruno.id,
      });

      const remocao = await testApp
        .http()
        .delete(url(`/projects/${projeto.id}/members/${bruno.id}`))
        .set(...bearer(admin.token));

      expect(remocao.status).toBe(403);
      const [linha] = (await testApp.dataSource.query(
        'SELECT assignee_id FROM tasks WHERE id = $1',
        [tarefa.id],
      )) as Array<{ assignee_id: string }>;
      expect(linha?.assignee_id).toBe(bruno.id);
    });
  });

  describe('R12: relatório agregado no banco', () => {
    let ana: UsuarioCriado;
    let bruno: UsuarioCriado;
    let alfa: string;
    let beta: string;

    /** Insere `quantidade` tarefas com status e responsável variados, direto no banco. */
    async function semear(projectId: string, quantidade: number) {
      await testApp.dataSource.query(
        `INSERT INTO tasks (project_id, title, status, assignee_id)
         SELECT $1, 'T' || n,
                (ARRAY['pendente','em_andamento','concluida'])[1 + (n % 3)]::task_status,
                (ARRAY[$2::uuid, $3::uuid, NULL::uuid])[1 + ((n * 7) % 3)]
         FROM generate_series(1, $4::int) AS n`,
        [projectId, ana.id, bruno.id, quantidade],
      );
    }

    const sqlPorStatus = async (projectIds: string[]) => {
      const linhas = (await testApp.dataSource.query(
        'SELECT status, count(*)::int AS n FROM tasks WHERE project_id = ANY($1) GROUP BY status',
        [projectIds],
      )) as Array<{ status: string; n: number }>;
      const porStatus = Object.fromEntries(linhas.map((l) => [l.status, l.n]));
      return {
        pendente: porStatus['pendente'] ?? 0,
        em_andamento: porStatus['em_andamento'] ?? 0,
        concluida: porStatus['concluida'] ?? 0,
      };
    };

    const sqlPorUsuario = async (projectIds: string[]) => {
      const linhas = (await testApp.dataSource.query(
        `SELECT t.assignee_id AS key, u.name AS label, count(*)::int AS count
         FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
         WHERE t.project_id = ANY($1) GROUP BY t.assignee_id, u.name`,
        [projectIds],
      )) as Array<{ key: string | null; label: string | null; count: number }>;
      return linhas
        .map((l) => ({
          key: l.key ?? 'sem_responsavel',
          label: l.label ?? 'Sem responsável',
          count: l.count,
        }))
        .sort(
          (a, b) =>
            b.count - a.count ||
            a.label.localeCompare(b.label) ||
            a.key.localeCompare(b.key),
        );
    };

    beforeEach(async () => {
      ana = await criarUsuario(testApp, { name: 'Ana' });
      bruno = await criarUsuario(testApp, { name: 'Bruno' });
      alfa = (await criarProjeto(testApp, ana, { name: 'Alfa' })).id;
      beta = (await criarProjeto(testApp, ana, { name: 'Beta' })).id;
      await adicionarMembro(testApp, ana, alfa, bruno, ProjectRole.Member);
      await adicionarMembro(testApp, ana, beta, bruno, ProjectRole.Member);
      await semear(alfa, 40);
      await semear(beta, 25);
      // Projeto de outra pessoa: nunca deve aparecer nos números da Ana.
      const estranha = await criarUsuario(testApp);
      const alheio = await criarProjeto(testApp, estranha);
      await testApp.dataSource.query(
        `INSERT INTO tasks (project_id, title, status) SELECT $1, 'X' || n, 'pendente' FROM generate_series(1, 9) n`,
        [alheio.id],
      );
    });

    const relatorio = (usuario: UsuarioCriado, query: string) =>
      testApp
        .http()
        .get(url(`/reports${query}`))
        .set(...bearer(usuario.token));

    it('por status, sem filtro: igual ao GROUP BY direto no banco', async () => {
      const response = await relatorio(ana, '?groupBy=status');

      const esperado = await sqlPorStatus([alfa, beta]);
      expect(response.body.byStatus).toEqual(esperado);
      expect(response.body.total).toBe(65);
      expect(
        response.body.groups.map((g: { count: number }) => g.count),
      ).toEqual([esperado.pendente, esperado.em_andamento, esperado.concluida]);
    });

    it('por status, com projectId: só aquele projeto', async () => {
      const response = await relatorio(
        ana,
        `?groupBy=status&projectId=${beta}`,
      );

      expect(response.body.byStatus).toEqual(await sqlPorStatus([beta]));
      expect(response.body.total).toBe(25);
    });

    it('por usuário, sem filtro: grupos e contagens iguais ao SQL, incluindo "Sem responsável"', async () => {
      const response = await relatorio(ana, '?groupBy=user');

      const esperado = await sqlPorUsuario([alfa, beta]);
      expect(esperado.some((g) => g.key === 'sem_responsavel')).toBe(true);
      expect(response.body.groups).toEqual(esperado);
      expect(
        response.body.groups.reduce(
          (s: number, g: { count: number }) => s + g.count,
          0,
        ),
      ).toBe(response.body.total);
    });

    it('por usuário, com projectId opcional: igual ao SQL daquele projeto', async () => {
      const response = await relatorio(
        bruno,
        `?groupBy=user&projectId=${alfa}`,
      );

      expect(response.body.groups).toEqual(await sqlPorUsuario([alfa]));
      expect(response.body.total).toBe(40);
    });

    it('o número de queries não cresce com a quantidade de tarefas (agregação, não carga em memória)', async () => {
      const pequeno = await contarQueries(testApp.dataSource, () =>
        relatorio(ana, '?groupBy=user'),
      );

      await semear(alfa, 1500);
      const grande = await contarQueries(testApp.dataSource, () =>
        relatorio(ana, '?groupBy=user'),
      );

      expect(pequeno.resultado.status).toBe(200);
      expect(grande.resultado.body.total).toBe(65 + 1500);
      expect(grande.queries.length).toBe(pequeno.queries.length);
      expect(grande.queries.length).toBeLessThanOrEqual(8);
      // Nenhuma query traz as tarefas linha a linha: todas agregam.
      const queriesDeTarefas = grande.queries.filter((q) =>
        /FROM "tasks"/.test(q),
      );
      expect(queriesDeTarefas.length).toBeGreaterThan(0);
      expect(
        queriesDeTarefas.every(
          (q) => /COUNT\(/i.test(q) && /GROUP BY/i.test(q),
        ),
      ).toBe(true);
    });
  });
});
