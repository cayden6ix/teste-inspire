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
  type ProjetoCriado,
  type TarefaCriada,
  type UsuarioCriado,
} from '../utils/factories.js';

const CSV_VALIDO =
  'titulo,descricao,status,responsavel_email,data_limite\nImportada,,pendente,,\n';

const NOMES_DAS_ROTAS = [
  'GET projeto',
  'PATCH projeto',
  'DELETE projeto',
  'GET membros',
  'POST membro',
  'PATCH papel do membro',
  'DELETE membro',
  'GET tarefas',
  'POST tarefa',
  'GET tarefa',
  'PATCH tarefa',
  'DELETE tarefa',
  'GET exportação',
  'POST importação (CSV puro)',
  'GET relatório do projeto',
];

/**
 * Autorização por papel dentro do projeto (D-013) e isolamento entre projetos (IDOR).
 */
describe('Autorização e IDOR (e2e)', () => {
  let testApp: TestApp;
  let dono: UsuarioCriado;
  let admin: UsuarioCriado;
  let membro: UsuarioCriado;
  let leitor: UsuarioCriado;
  let intruso: UsuarioCriado;
  let projeto: ProjetoCriado;
  let tarefa: TarefaCriada;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.close();
  });

  beforeEach(async () => {
    await limparBanco(testApp.dataSource);
    dono = await criarUsuario(testApp, { name: 'Dono' });
    admin = await criarUsuario(testApp, { name: 'Admin' });
    membro = await criarUsuario(testApp, { name: 'Membro' });
    leitor = await criarUsuario(testApp, { name: 'Leitor' });
    intruso = await criarUsuario(testApp, { name: 'Intruso' });

    projeto = await criarProjeto(testApp, dono, {
      name: 'Projeto do Dono',
      description: 'Original',
    });
    await adicionarMembro(testApp, dono, projeto.id, admin, ProjectRole.Admin);
    await adicionarMembro(
      testApp,
      dono,
      projeto.id,
      membro,
      ProjectRole.Member,
    );
    await adicionarMembro(
      testApp,
      dono,
      projeto.id,
      leitor,
      ProjectRole.Viewer,
    );
    tarefa = await criarTarefa(testApp, dono, projeto.id, {
      title: 'Tarefa original',
    });
  });

  const base = () => `/projects/${projeto.id}`;

  /** Todas as rotas que tocam o projeto, os membros e as tarefas. */
  const rotas = () =>
    [
      { nome: 'GET projeto', metodo: 'get', caminho: base() },
      {
        nome: 'PATCH projeto',
        metodo: 'patch',
        caminho: base(),
        corpo: { name: 'Hackeado' },
      },
      { nome: 'DELETE projeto', metodo: 'delete', caminho: base() },
      { nome: 'GET membros', metodo: 'get', caminho: `${base()}/members` },
      {
        nome: 'POST membro',
        metodo: 'post',
        caminho: `${base()}/members`,
        corpo: { userId: intruso.id, role: 'member' },
      },
      {
        nome: 'PATCH papel do membro',
        metodo: 'patch',
        caminho: `${base()}/members/${membro.id}`,
        corpo: { role: 'viewer' },
      },
      {
        nome: 'DELETE membro',
        metodo: 'delete',
        caminho: `${base()}/members/${membro.id}`,
      },
      { nome: 'GET tarefas', metodo: 'get', caminho: `${base()}/tasks` },
      {
        nome: 'POST tarefa',
        metodo: 'post',
        caminho: `${base()}/tasks`,
        corpo: { title: 'Invasora' },
      },
      {
        nome: 'GET tarefa',
        metodo: 'get',
        caminho: `${base()}/tasks/${tarefa.id}`,
      },
      {
        nome: 'PATCH tarefa',
        metodo: 'patch',
        caminho: `${base()}/tasks/${tarefa.id}`,
        corpo: { title: 'Hackeada' },
      },
      {
        nome: 'DELETE tarefa',
        metodo: 'delete',
        caminho: `${base()}/tasks/${tarefa.id}`,
      },
      {
        nome: 'GET exportação',
        metodo: 'get',
        caminho: `${base()}/tasks/export`,
      },
      {
        nome: 'POST importação (CSV puro)',
        metodo: 'post',
        caminho: `${base()}/tasks/import`,
        corpo: CSV_VALIDO,
        tipo: 'text/csv',
      },
      {
        nome: 'GET relatório do projeto',
        metodo: 'get',
        caminho: `/reports?projectId=${projeto.id}`,
      },
    ] as const;

  type Rota = ReturnType<typeof rotas>[number];

  const chamar = async (rota: Rota, usuario: UsuarioCriado) => {
    const http = testApp.http();
    const requisicao = http[rota.metodo](url(rota.caminho)).set(
      ...bearer(usuario.token),
    );
    if ('tipo' in rota) {
      requisicao.set('Content-Type', rota.tipo);
    }
    return 'corpo' in rota ? requisicao.send(rota.corpo) : requisicao;
  };

  /** O projeto, os membros e as tarefas do dono continuam exatamente como estavam. */
  const verificarIntacto = async () => {
    const [{ name, description }] = (await testApp.dataSource.query(
      'SELECT name, description FROM projects WHERE id = $1',
      [projeto.id],
    )) as Array<{ name: string; description: string }>;
    expect({ name, description }).toEqual({
      name: 'Projeto do Dono',
      description: 'Original',
    });

    const membros = (await testApp.dataSource.query(
      'SELECT user_id, role FROM project_members WHERE project_id = $1 ORDER BY role',
      [projeto.id],
    )) as Array<{ user_id: string; role: string }>;
    expect(membros).toHaveLength(4);
    expect(membros.find((m) => m.user_id === membro.id)?.role).toBe('member');
    expect(membros.some((m) => m.user_id === intruso.id)).toBe(false);

    const tarefas = (await testApp.dataSource.query(
      'SELECT id, title FROM tasks WHERE project_id = $1',
      [projeto.id],
    )) as Array<{ id: string; title: string }>;
    expect(tarefas).toEqual([{ id: tarefa.id, title: 'Tarefa original' }]);
  };

  describe('usuário sem vínculo com o projeto (IDOR)', () => {
    // D-027: para quem não é membro, o projeto alheio é indistinguível de um id inexistente.
    it.each(NOMES_DAS_ROTAS)('%s devolve 404 "Projeto não encontrado."', async (nome) => {
      const rota = rotas().find((candidata) => candidata.nome === nome)!;

      const response = await chamar(rota, intruso);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
      expect(response.body.message).toBe('Projeto não encontrado.');
    });

    it.each(NOMES_DAS_ROTAS)(
      '%s: projeto alheio e projeto inexistente têm a mesma resposta (status e mensagem)',
      async (nome) => {
        const rota = rotas().find((candidata) => candidata.nome === nome)!;
        const caminhoInexistente = rota.caminho.split(projeto.id).join(randomUUID());

        const alheio = await chamar(rota, intruso);
        const inexistente = await chamar(
          { ...rota, caminho: caminhoInexistente } as Rota,
          intruso,
        );

        expect(inexistente.status).toBe(alheio.status);
        expect(inexistente.body.message).toBe(alheio.body.message);
      },
    );

    it('depois de todas as tentativas, os dados do dono estão intactos', async () => {
      for (const rota of rotas()) {
        await chamar(rota, intruso);
      }

      await verificarIntacto();
    });

    it('o projeto do dono não aparece na listagem do intruso', async () => {
      const response = await testApp
        .http()
        .get(url('/projects'))
        .set(...bearer(intruso.token));

      expect(response.body.data).toEqual([]);
    });

    it('o relatório geral do intruso não conta as tarefas do projeto alheio', async () => {
      const response = await testApp
        .http()
        .get(url('/reports'))
        .set(...bearer(intruso.token));

      expect(response.status).toBe(200);
      expect(response.body.total).toBe(0);
    });

    it('conhecer o id da tarefa não ajuda: usá-lo em outro projeto do próprio intruso dá 404', async () => {
      const proprio = await criarProjeto(testApp, intruso, {
        name: 'Do intruso',
      });

      const response = await testApp
        .http()
        .get(url(`/projects/${proprio.id}/tasks/${tarefa.id}`))
        .set(...bearer(intruso.token));

      expect(response.status).toBe(404);
    });

    it('projeto inexistente devolve 404, e não 403', async () => {
      const response = await testApp
        .http()
        .get(url(`/projects/${randomUUID()}/tasks`))
        .set(...bearer(intruso.token));

      expect(response.status).toBe(404);
    });
  });

  describe('viewer: só leitura', () => {
    it.each([
      ['GET projeto', 200],
      ['GET membros', 200],
      ['GET tarefas', 200],
      ['GET tarefa', 200],
      ['GET exportação', 200],
      ['GET relatório do projeto', 200],
    ])('%s devolve %i', async (nome, status) => {
      const rota = rotas().find((candidata) => candidata.nome === nome)!;

      const response = await chamar(rota, leitor);

      expect(response.status).toBe(status);
    });

    it.each([
      'PATCH projeto',
      'DELETE projeto',
      'POST membro',
      'PATCH papel do membro',
      'DELETE membro',
      'POST tarefa',
      'PATCH tarefa',
      'DELETE tarefa',
      'POST importação (CSV puro)',
    ])('%s devolve 403', async (nome) => {
      const rota = rotas().find((candidata) => candidata.nome === nome)!;

      const response = await chamar(rota, leitor);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe(
        'Seu papel no projeto não permite esta ação.',
      );
    });

    it('depois das tentativas de escrita, nada mudou', async () => {
      for (const rota of rotas()) {
        if (rota.metodo !== 'get') {
          await chamar(rota, leitor);
        }
      }

      await verificarIntacto();
    });
  });

  describe('member: trabalha nas tarefas, não gerencia o projeto', () => {
    it('cria, edita e exclui tarefas', async () => {
      const criada = await testApp
        .http()
        .post(url(`${base()}/tasks`))
        .set(...bearer(membro.token))
        .send({ title: 'Do membro', assigneeId: membro.id });
      const editada = await testApp
        .http()
        .patch(url(`${base()}/tasks/${criada.body.id}`))
        .set(...bearer(membro.token))
        .send({ status: 'concluida' });
      const excluida = await testApp
        .http()
        .delete(url(`${base()}/tasks/${criada.body.id}`))
        .set(...bearer(membro.token));

      expect([criada.status, editada.status, excluida.status]).toEqual([
        201, 200, 204,
      ]);
    });

    it('importa e exporta CSV', async () => {
      const importacao = await chamar(
        rotas().find((r) => r.nome === 'POST importação (CSV puro)')!,
        membro,
      );
      const exportacao = await chamar(
        rotas().find((r) => r.nome === 'GET exportação')!,
        membro,
      );

      expect(importacao.status).toBe(201);
      expect(exportacao.status).toBe(200);
    });

    it.each([
      'PATCH projeto',
      'DELETE projeto',
      'POST membro',
      'PATCH papel do membro',
      'DELETE membro',
    ])('%s devolve 403', async (nome) => {
      const rota = rotas().find((candidata) => candidata.nome === nome)!;

      const response = await chamar(rota, membro);

      expect(response.status).toBe(403);
    });

    it('lê o projeto e a lista de membros', async () => {
      const projetoResp = await chamar(
        rotas().find((r) => r.nome === 'GET projeto')!,
        membro,
      );
      const membrosResp = await chamar(
        rotas().find((r) => r.nome === 'GET membros')!,
        membro,
      );

      expect(projetoResp.status).toBe(200);
      expect(membrosResp.status).toBe(200);
    });
  });

  describe('admin: gerencia o projeto, mas não o exclui', () => {
    it('edita o projeto', async () => {
      const response = await chamar(
        rotas().find((r) => r.nome === 'PATCH projeto')!,
        admin,
      );

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Hackeado');
    });

    it('não exclui o projeto (só o owner)', async () => {
      const response = await chamar(
        rotas().find((r) => r.nome === 'DELETE projeto')!,
        admin,
      );

      expect(response.status).toBe(403);
      const existe = await testApp
        .http()
        .get(url(base()))
        .set(...bearer(dono.token));
      expect(existe.status).toBe(200);
    });

    it('adiciona um membro com papel member', async () => {
      const response = await chamar(
        rotas().find((r) => r.nome === 'POST membro')!,
        admin,
      );

      expect(response.status).toBe(201);
      expect(response.body.role).toBe('member');
    });
  });

  describe('owner', () => {
    it('exclui o projeto', async () => {
      const response = await chamar(
        rotas().find((r) => r.nome === 'DELETE projeto')!,
        dono,
      );

      expect(response.status).toBe(204);
    });
  });

  describe('papel é por projeto', () => {
    it('quem é owner de um projeto não ganha acesso a outro', async () => {
      const outroProjeto = await criarProjeto(testApp, intruso, {
        name: 'Outro',
      });

      const comoDono = await testApp
        .http()
        .get(url(`/projects/${outroProjeto.id}`))
        .set(...bearer(dono.token));
      const comoIntruso = await testApp
        .http()
        .get(url(`/projects/${outroProjeto.id}`))
        .set(...bearer(intruso.token));

      expect(comoDono.status).toBe(404);
      expect(comoIntruso.status).toBe(200);
    });

    it('o mesmo usuário pode ter papéis diferentes em projetos diferentes', async () => {
      const outroProjeto = await criarProjeto(testApp, intruso, {
        name: 'Do intruso',
      });
      await adicionarMembro(
        testApp,
        intruso,
        outroProjeto.id,
        leitor,
        ProjectRole.Admin,
      );

      const noOutro = await testApp
        .http()
        .patch(url(`/projects/${outroProjeto.id}`))
        .set(...bearer(leitor.token))
        .send({ name: 'Renomeado pelo admin' });
      const noOriginal = await testApp
        .http()
        .patch(url(base()))
        .set(...bearer(leitor.token))
        .send({ name: 'Não deveria' });

      expect(noOutro.status).toBe(200);
      expect(noOriginal.status).toBe(403);
    });
  });
});
