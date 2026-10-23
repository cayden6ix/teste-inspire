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
  semearTarefasComMesmoInstante,
  url,
  type ProjetoCriado,
  type UsuarioCriado,
} from '../utils/factories.js';

type Tarefa = { id: string; title: string };

describe('Tarefas (e2e)', () => {
  let testApp: TestApp;
  let ana: UsuarioCriado;
  let bruno: UsuarioCriado;
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
    projeto = await criarProjeto(testApp, ana, { name: 'Projeto' });
    await adicionarMembro(testApp, ana, projeto.id, bruno, ProjectRole.Member);
  });

  const tarefasUrl = (sufixo = '', projectId = projeto.id) =>
    url(`/projects/${projectId}/tasks${sufixo}`);

  const listar = (query = '', usuario = ana, projectId = projeto.id) =>
    testApp
      .http()
      .get(tarefasUrl(query, projectId))
      .set(...bearer(usuario.token));

  const titulos = (response: { body: { data: Tarefa[] } }) =>
    response.body.data.map((t) => t.title);

  describe('tipos no corpo sem conversão implícita (A4)', () => {
    it.each([
      ['POST', { title: 123 }],
      ['POST', { title: true }],
      ['PATCH', { title: 123 }],
    ])('%s com title numérico/booleano devolve 400 e não grava', async (metodo, corpo) => {
      const existente = await criarTarefa(testApp, ana, projeto.id, { title: 'Original' });
      const requisicao =
        metodo === 'POST'
          ? testApp.http().post(tarefasUrl())
          : testApp.http().patch(tarefasUrl(`/${existente.id}`));

      const response = await requisicao.set(...bearer(ana.token)).send(corpo);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual(['O campo "Título" deve ser um texto.']);
      const titulosNoBanco = (
        (await testApp.dataSource.query('SELECT title FROM tasks WHERE project_id = $1', [
          projeto.id,
        ])) as Array<{ title: string }>
      ).map((linha) => linha.title);
      expect(titulosNoBanco).toEqual(['Original']);
    });

    it('description, status, assigneeId e dueDate com tipo errado devolvem 400', async () => {
      const response = await testApp
        .http()
        .post(tarefasUrl())
        .set(...bearer(ana.token))
        .send({ title: 'Ok', description: 10, status: 1, assigneeId: 2, dueDate: 20260101 });

      expect(response.status).toBe(400);
      expect(response.body.message).toHaveLength(4);
      expect(response.body.message[0]).toBe('O campo "Descrição" deve ser um texto.');
    });
  });

  describe('POST /projects/:projectId/tasks', () => {
    it('cria com os padrões: status pendente, sem responsável nem prazo', async () => {
      const response = await testApp
        .http()
        .post(tarefasUrl())
        .set(...bearer(ana.token))
        .send({ title: '  Modelar o banco  ' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        projectId: projeto.id,
        title: 'Modelar o banco',
        description: null,
        status: 'pendente',
        assigneeId: null,
        assigneeName: null,
        dueDate: null,
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('cria com todos os campos e devolve o nome do responsável', async () => {
      const response = await testApp
        .http()
        .post(tarefasUrl())
        .set(...bearer(ana.token))
        .send({
          title: 'Implementar login',
          description: 'JWT + bcrypt',
          status: TaskStatus.EmAndamento,
          assigneeId: bruno.id,
          dueDate: '2026-11-30',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        description: 'JWT + bcrypt',
        status: 'em_andamento',
        assigneeId: bruno.id,
        assigneeName: 'Bruno',
        dueDate: '2026-11-30',
      });
    });

    it('o responsável precisa ser membro do projeto (400)', async () => {
      const forasteiro = await criarUsuario(testApp, { name: 'Forasteiro' });

      const response = await testApp
        .http()
        .post(tarefasUrl())
        .set(...bearer(ana.token))
        .send({ title: 'Tarefa', assigneeId: forasteiro.id });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'O responsável precisa ser membro do projeto.',
      );
      expect(await listar()).toHaveProperty('body.meta.total', 0);
    });

    it.each([
      {
        corpo: { title: '   ' },
        mensagem: 'O campo "Título" não pode estar vazio.',
      },
      { corpo: {}, mensagem: 'O campo "Título" não pode estar vazio.' },
      {
        corpo: { title: 'a'.repeat(201) },
        mensagem: 'O campo "Título" deve ter no máximo 200 caracteres.',
      },
      {
        corpo: { title: 'T', status: 'feito' },
        mensagem:
          'O campo "Status" deve ser um dos valores: pendente, em_andamento, concluida.',
      },
      {
        corpo: { title: 'T', assigneeId: 'não-uuid' },
        mensagem:
          'O campo "Responsável" deve ser um identificador válido (UUID).',
      },
      {
        corpo: { title: 'T', projectId: randomUUID() },
        mensagem: 'O campo "Projeto" não é permitido.',
      },
    ])(
      'dados inválidos devolvem 400: $mensagem',
      async ({ corpo, mensagem }) => {
        const response = await testApp
          .http()
          .post(tarefasUrl())
          .set(...bearer(ana.token))
          .send(corpo);

        expect(response.status).toBe(400);
        expect(response.body.message).toEqual([mensagem]);
      },
    );

    it('projeto inexistente devolve 404', async () => {
      const response = await testApp
        .http()
        .post(tarefasUrl('', randomUUID()))
        .set(...bearer(ana.token))
        .send({ title: 'T' });

      expect(response.status).toBe(404);
    });

    describe('data limite (dueDate) inválida', () => {
      const casos = [
        { nome: 'texto livre', valor: 'amanhã' },
        { nome: 'formato brasileiro', valor: '31/12/2026' },
        {
          nome: 'datetime com hora e fuso (viraria outro dia na coluna date)',
          valor: '2026-01-01T23:30:00-03:00',
        },
        { nome: 'datetime UTC', valor: '2026-01-01T10:00:00Z' },
        { nome: 'mês inexistente', valor: '2026-13-01' },
        {
          nome: 'dia inexistente no calendário (30 de fevereiro)',
          valor: '2026-02-30',
        },
        { nome: 'número', valor: 20260101 },
      ];

      it.each(casos)(
        'criar com $nome devolve 400, nunca 500',
        async ({ valor }) => {
          const response = await testApp
            .http()
            .post(tarefasUrl())
            .set(...bearer(ana.token))
            .send({ title: 'Com data ruim', dueDate: valor });

          expect(response.status).toBe(400);
          expect(response.body.message).toEqual([
            expect.stringContaining('"Data limite"'),
          ]);
          expect(await listar()).toHaveProperty('body.meta.total', 0);
        },
      );

      it.each(casos)(
        'editar com $nome devolve 400 e a tarefa não muda',
        async ({ valor }) => {
          const tarefa = await criarTarefa(testApp, ana, projeto.id, {
            dueDate: '2026-05-05',
          });

          const response = await testApp
            .http()
            .patch(tarefasUrl(`/${tarefa.id}`))
            .set(...bearer(ana.token))
            .send({ dueDate: valor });

          expect(response.status).toBe(400);
          const depois = await testApp
            .http()
            .get(tarefasUrl(`/${tarefa.id}`))
            .set(...bearer(ana.token));
          expect(depois.body.dueDate).toBe('2026-05-05');
        },
      );

      it.each(['2026-02-30', '2026-13-01', '2026-1-1', 'ontem'])(
        'filtros dueFrom/dueTo com %s devolvem 400',
        async (valor) => {
          expect((await listar(`?dueFrom=${valor}`)).status).toBe(400);
          expect((await listar(`?dueTo=${valor}`)).status).toBe(400);
        },
      );

      it('datas válidas no formato AAAA-MM-DD (inclusive 29 de fevereiro em ano bissexto) são aceitas', async () => {
        for (const dueDate of ['2026-12-31', '2028-02-29', '2026-01-01']) {
          const response = await testApp
            .http()
            .post(tarefasUrl())
            .set(...bearer(ana.token))
            .send({ title: `Prazo ${dueDate}`, dueDate });

          expect(response.status).toBe(201);
          expect(response.body.dueDate).toBe(dueDate);
        }
      });
    });
  });

  describe('GET / PATCH / DELETE de uma tarefa', () => {
    it('detalha a tarefa do projeto', async () => {
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        title: 'Detalhe',
        assigneeId: bruno.id,
      });

      const response = await testApp
        .http()
        .get(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(bruno.token));

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: tarefa.id,
        title: 'Detalhe',
        assigneeName: 'Bruno',
      });
    });

    it('PATCH atualiza só os campos enviados', async () => {
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        title: 'Original',
        description: 'Texto',
        dueDate: '2026-12-01',
      });

      const response = await testApp
        .http()
        .patch(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(bruno.token))
        .send({ status: TaskStatus.Concluida });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        title: 'Original',
        description: 'Texto',
        dueDate: '2026-12-01',
        status: 'concluida',
      });
    });

    it('PATCH troca e remove o responsável, e limpa descrição e prazo com null', async () => {
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        description: 'Texto',
        dueDate: '2026-12-01',
      });

      const comResponsavel = await testApp
        .http()
        .patch(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token))
        .send({ assigneeId: bruno.id });
      const limpa = await testApp
        .http()
        .patch(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token))
        .send({ assigneeId: null, description: null, dueDate: null });

      expect(comResponsavel.body).toMatchObject({
        assigneeId: bruno.id,
        assigneeName: 'Bruno',
      });
      expect(limpa.body).toMatchObject({
        assigneeId: null,
        assigneeName: null,
        description: null,
        dueDate: null,
      });
    });

    it('PATCH reatribui a tarefa de um responsável para outro e persiste no banco', async () => {
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        assigneeId: bruno.id,
      });

      const response = await testApp
        .http()
        .patch(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token))
        .send({ assigneeId: ana.id });

      const [linha] = (await testApp.dataSource.query(
        'SELECT assignee_id FROM tasks WHERE id = $1',
        [tarefa.id],
      )) as Array<{ assignee_id: string | null }>;
      expect(response.body).toMatchObject({
        assigneeId: ana.id,
        assigneeName: 'Ana',
      });
      expect(linha?.assignee_id).toBe(ana.id);
    });

    it('PATCH com responsável fora do projeto devolve 400 e não altera a tarefa', async () => {
      const forasteiro = await criarUsuario(testApp);
      const tarefa = await criarTarefa(testApp, ana, projeto.id, {
        title: 'Intacta',
      });

      const response = await testApp
        .http()
        .patch(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token))
        .send({ title: 'Mudou', assigneeId: forasteiro.id });

      expect(response.status).toBe(400);
      const depois = await testApp
        .http()
        .get(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token));
      expect(depois.body.title).toBe('Intacta');
    });

    it('DELETE devolve 204 e depois a tarefa dá 404', async () => {
      const tarefa = await criarTarefa(testApp, ana, projeto.id);

      const exclusao = await testApp
        .http()
        .delete(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token));
      const depois = await testApp
        .http()
        .get(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token));

      expect(exclusao.status).toBe(204);
      expect(depois.status).toBe(404);
      expect(depois.body.message).toBe('Tarefa não encontrada.');
    });

    it('uma tarefa só é acessível pelo próprio projeto: id de outro projeto devolve 404', async () => {
      const outroProjeto = await criarProjeto(testApp, ana, { name: 'Outro' });
      const tarefa = await criarTarefa(testApp, ana, projeto.id);

      const get = await testApp
        .http()
        .get(tarefasUrl(`/${tarefa.id}`, outroProjeto.id))
        .set(...bearer(ana.token));
      const patch = await testApp
        .http()
        .patch(tarefasUrl(`/${tarefa.id}`, outroProjeto.id))
        .set(...bearer(ana.token))
        .send({ title: 'Invadida' });
      const del = await testApp
        .http()
        .delete(tarefasUrl(`/${tarefa.id}`, outroProjeto.id))
        .set(...bearer(ana.token));

      expect([get.status, patch.status, del.status]).toEqual([404, 404, 404]);
      const intacta = await testApp
        .http()
        .get(tarefasUrl(`/${tarefa.id}`))
        .set(...bearer(ana.token));
      expect(intacta.body.title).toBe(tarefa.title);
    });

    it('ids que não são UUID devolvem 400', async () => {
      const response = await testApp
        .http()
        .get(tarefasUrl('/abc'))
        .set(...bearer(ana.token));

      expect(response.status).toBe(400);
    });
  });

  describe('GET /projects/:projectId/tasks (listagem)', () => {
    it('devolve {data, meta}, mais recentes primeiro por padrão', async () => {
      await criarTarefa(testApp, ana, projeto.id, { title: 'Primeira' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Segunda' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Terceira' });

      const response = await listar();

      expect(response.status).toBe(200);
      expect(titulos(response)).toEqual(['Terceira', 'Segunda', 'Primeira']);
      expect(response.body.meta).toEqual({
        page: 1,
        limit: 15,
        total: 3,
        totalPages: 1,
      });
    });

    it('filtra por status', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'A',
        status: TaskStatus.Pendente,
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'B',
        status: TaskStatus.Concluida,
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'C',
        status: TaskStatus.Concluida,
      });

      const response = await listar('?status=concluida&sortBy=title&order=asc');

      expect(titulos(response)).toEqual(['B', 'C']);
      expect(response.body.meta.total).toBe(2);
    });

    it('filtra por responsável', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Do Bruno',
        assigneeId: bruno.id,
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Da Ana',
        assigneeId: ana.id,
      });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Sem dono' });

      const response = await listar(`?assigneeId=${bruno.id}`);

      expect(titulos(response)).toEqual(['Do Bruno']);
    });

    it('busca em título e descrição, sem diferenciar maiúsculas, e trata % literalmente', async () => {
      await criarTarefa(testApp, ana, projeto.id, { title: 'Corrigir LOGIN' });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Outra',
        description: 'tela de login',
      });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Sem relação' });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Meta de 50% feita',
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Meta de 500 itens',
      });

      const login = await listar('?search=login&sortBy=title&order=asc');
      const porcento = await listar(`?search=${encodeURIComponent('50%')}`);

      expect(titulos(login)).toEqual(['Corrigir LOGIN', 'Outra']);
      expect(titulos(porcento)).toEqual(['Meta de 50% feita']);
    });

    it('busca sem diferenciar acentos (D-029): "descricao" acha "Descrição" e "integracao" acha "Integração"', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Revisar texto',
        description: 'Descrição do módulo',
      });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Integração com ERP' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Sem relação' });

      const descricao = await listar('?search=descricao');
      const integracao = await listar('?search=INTEGRACAO');
      const comAcentoNoTermo = await listar(`?search=${encodeURIComponent('Integração')}`);

      expect(titulos(descricao)).toEqual(['Revisar texto']);
      expect(titulos(integracao)).toEqual(['Integração com ERP']);
      expect(titulos(comAcentoNoTermo)).toEqual(['Integração com ERP']);
    });

    it('com unaccent, % e _ digitados continuam literais (não viram curinga)', async () => {
      await criarTarefa(testApp, ana, projeto.id, { title: 'Ação 100% concluída' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Acao 1000 itens' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'campo_nome' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'campoXnome' });

      const porcento = await listar(`?search=${encodeURIComponent('acao 100%')}`);
      const sublinhado = await listar(`?search=${encodeURIComponent('campo_')}`);
      const tudo = await listar(`?search=${encodeURIComponent('%')}`);

      expect(titulos(porcento)).toEqual(['Ação 100% concluída']);
      expect(titulos(sublinhado)).toEqual(['campo_nome']);
      expect(titulos(tudo)).toEqual(['Ação 100% concluída']);
    });

    it('filtra por intervalo de prazo (inclusivo) e ignora tarefas sem prazo', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Jan',
        dueDate: '2026-01-15',
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Fev',
        dueDate: '2026-02-15',
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Mar',
        dueDate: '2026-03-15',
      });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Sem prazo' });

      const intervalo = await listar(
        '?dueFrom=2026-02-15&dueTo=2026-03-15&sortBy=dueDate&order=asc',
      );
      const soInicio = await listar('?dueFrom=2026-02-16');
      const soFim = await listar('?dueTo=2026-01-15');
      const mesmoDia = await listar('?dueFrom=2026-02-15&dueTo=2026-02-15');

      expect(titulos(intervalo)).toEqual(['Fev', 'Mar']);
      expect(titulos(soInicio)).toEqual(['Mar']);
      expect(titulos(soFim)).toEqual(['Jan']);
      expect(titulos(mesmoDia)).toEqual(['Fev']);
    });

    it('combina filtros', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Alvo',
        status: TaskStatus.EmAndamento,
        assigneeId: bruno.id,
        dueDate: '2026-05-01',
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Alvo outro status',
        status: TaskStatus.Pendente,
        assigneeId: bruno.id,
        dueDate: '2026-05-01',
      });

      const response = await listar(
        `?status=em_andamento&assigneeId=${bruno.id}&search=alvo&dueFrom=2026-05-01&dueTo=2026-05-31`,
      );

      expect(titulos(response)).toEqual(['Alvo']);
    });

    it('dueFrom posterior a dueTo devolve 400', async () => {
      const response = await listar('?dueFrom=2026-12-31&dueTo=2026-01-01');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'A data limite inicial não pode ser posterior à data limite final.',
      );
    });

    it.each([
      {
        query: '?limit=101',
        mensagem: 'O campo "Limite" deve ser menor ou igual a 100.',
      },
      {
        query: '?page=0',
        mensagem: 'O campo "Página" deve ser maior ou igual a 1.',
      },
      {
        query: '?sortBy=assignee',
        mensagem:
          'O campo "Ordenar por" deve ser um dos valores: title, status, dueDate, createdAt, updatedAt.',
      },
      {
        query: '?status=feito',
        mensagem:
          'O campo "Status" deve ser um dos valores: pendente, em_andamento, concluida.',
      },
    ])('parâmetro inválido $query devolve 400', async ({ query, mensagem }) => {
      const response = await listar(query);

      expect(response.status).toBe(400);
      expect(response.body.message).toEqual([mensagem]);
    });

    it('datas fora do formato AAAA-MM-DD devolvem 400', async () => {
      for (const query of [
        '?dueFrom=01/02/2026',
        '?dueTo=amanha',
        '?dueFrom=2026-13-45',
      ]) {
        const response = await listar(query);

        expect(response.status, query).toBe(400);
      }
    });

    it('ordena por título nos dois sentidos', async () => {
      for (const titulo of ['Banana', 'Abacaxi', 'Cereja']) {
        await criarTarefa(testApp, ana, projeto.id, { title: titulo });
      }

      expect(titulos(await listar('?sortBy=title&order=asc'))).toEqual([
        'Abacaxi',
        'Banana',
        'Cereja',
      ]);
      expect(titulos(await listar('?sortBy=title&order=desc'))).toEqual([
        'Cereja',
        'Banana',
        'Abacaxi',
      ]);
    });

    it('paginação: páginas coerentes com meta e fora do intervalo devolvem lista vazia', async () => {
      await semearTarefasComMesmoInstante(testApp.dataSource, projeto.id, 25);

      const p1 = await listar('?limit=10&page=1');
      const p3 = await listar('?limit=10&page=3');
      const p4 = await listar('?limit=10&page=4');

      expect(p1.body.data).toHaveLength(10);
      expect(p3.body.data).toHaveLength(5);
      expect(p1.body.meta).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
      });
      expect(p4.status).toBe(200);
      expect(p4.body.data).toEqual([]);
    });

    it('ordem estável createdAt desc + id desc: tarefas no mesmo instante não repetem nem se perdem entre páginas', async () => {
      await semearTarefasComMesmoInstante(testApp.dataSource, projeto.id, 35);

      const vistos: string[] = [];
      for (const page of [1, 2, 3, 4]) {
        const response = await listar(`?limit=10&page=${page}`);
        vistos.push(...response.body.data.map((t: Tarefa) => t.id));
      }

      expect(vistos).toHaveLength(35);
      expect(new Set(vistos).size).toBe(35);
      // Mesmo createdAt em todas: a sequência é o id em ordem decrescente.
      expect(vistos).toEqual([...vistos].sort().reverse());

      const repetida = await listar('?limit=10&page=2');
      expect(repetida.body.data.map((t: Tarefa) => t.id)).toEqual(
        vistos.slice(10, 20),
      );
    });

    it('ordem asc também desempata por id (createdAt asc + id asc)', async () => {
      await semearTarefasComMesmoInstante(testApp.dataSource, projeto.id, 12);

      const vistos: string[] = [];
      for (const page of [1, 2, 3]) {
        const response = await listar(`?limit=5&page=${page}&order=asc`);
        vistos.push(...response.body.data.map((t: Tarefa) => t.id));
      }

      expect(new Set(vistos).size).toBe(12);
      expect(vistos).toEqual([...vistos].sort());
    });
  });
});
