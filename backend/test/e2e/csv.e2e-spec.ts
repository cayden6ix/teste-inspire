import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
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

const CABECALHO = 'titulo,descricao,status,responsavel_email,data_limite';

/** BOM do UTF-8 que abre o CSV exportado (D-030). */
const BOM = '\uFEFF';

const MENSAGEM_NAO_CSV = 'O arquivo enviado não parece ser um CSV válido.';

function fixture(nome: string): string {
  return readFileSync(new URL(`../fixtures/${nome}`, import.meta.url), 'utf8');
}

describe('CSV: exportação e importação (e2e)', () => {
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
    ana = await criarUsuario(testApp, {
      name: 'Ana',
      email: 'ana@empresa.com',
    });
    bruno = await criarUsuario(testApp, {
      name: 'Bruno',
      email: 'bruno@empresa.com',
    });
    projeto = await criarProjeto(testApp, ana, { name: 'Projeto CSV' });
    await adicionarMembro(testApp, ana, projeto.id, bruno, ProjectRole.Member);
  });

  const exportar = (projectId = projeto.id, usuario = ana) =>
    testApp
      .http()
      .get(url(`/projects/${projectId}/tasks/export`))
      .set(...bearer(usuario.token));

  const importarCsvPuro = (
    csv: string,
    projectId = projeto.id,
    usuario = ana,
  ) =>
    testApp
      .http()
      .post(url(`/projects/${projectId}/tasks/import`))
      .set(...bearer(usuario.token))
      .set('Content-Type', 'text/csv')
      .send(csv);

  const importarArquivo = (
    csv: string | Buffer,
    projectId = projeto.id,
    usuario = ana,
  ) =>
    testApp
      .http()
      .post(url(`/projects/${projectId}/tasks/import`))
      .set(...bearer(usuario.token))
      .attach('file', Buffer.isBuffer(csv) ? csv : Buffer.from(csv, 'utf8'), {
        filename: 'tarefas.csv',
        contentType: 'text/csv',
      });

  const listarTudo = async (projectId = projeto.id, usuario = ana) => {
    const response = await testApp
      .http()
      .get(url(`/projects/${projectId}/tasks?limit=100&sortBy=title&order=asc`))
      .set(...bearer(usuario.token));
    return response.body.data as Array<{
      title: string;
      description: string | null;
      status: string;
      assigneeId: string | null;
      dueDate: string | null;
    }>;
  };

  describe('GET /projects/:projectId/tasks/export', () => {
    it('devolve text/csv com anexo e só o cabeçalho quando não há tarefas', async () => {
      const response = await exportar();

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^text\/csv/);
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="tarefas-${projeto.id}.csv"`,
      );
      expect(response.text).toBe(`${BOM}${CABECALHO}\n`);
    });

    it('o arquivo começa com o BOM do UTF-8 (bytes EF BB BF), para o Excel em português', async () => {
      await criarTarefa(testApp, ana, projeto.id, { title: 'Integração' });

      const response = await exportar().buffer(true).parse((res, callback) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => callback(null, Buffer.concat(partes)));
      });
      const bytes = response.body as Buffer;

      expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
      expect(bytes.toString('utf8')).toContain('Integração');
      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    });

    it('exporta todas as tarefas (sem paginar), em ordem cronológica, com as colunas do contrato', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Modelar o banco',
        description: 'Definir tabelas',
        status: TaskStatus.EmAndamento,
        assigneeId: bruno.id,
        dueDate: '2026-11-01',
      });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Sem detalhes' });

      const response = await exportar();

      const linhas = parse(response.text, { columns: true, bom: true }) as Array<
        Record<string, string>
      >;
      // D-020: a exportação sai da mais antiga para a mais nova (a lista continua ao contrário).
      expect(linhas).toEqual([
        {
          titulo: 'Modelar o banco',
          descricao: 'Definir tabelas',
          status: 'em_andamento',
          responsavel_email: 'bruno@empresa.com',
          data_limite: '2026-11-01',
        },
        {
          titulo: 'Sem detalhes',
          descricao: '',
          status: 'pendente',
          responsavel_email: '',
          data_limite: '',
        },
      ]);
    });

    it('não é limitada pela paginação: exporta mais de 100 tarefas', async () => {
      await testApp.dataSource.query(
        `INSERT INTO tasks (project_id, title, status)
         SELECT $1, 'Tarefa ' || n, 'pendente' FROM generate_series(1, 130) AS n`,
        [projeto.id],
      );

      const response = await exportar();

      expect(
        (parse(response.text, { columns: true, bom: true }) as unknown[]).length,
      ).toBe(130);
    });

    it('exporta apenas as tarefas do próprio projeto', async () => {
      const outro = await criarProjeto(testApp, ana, { name: 'Outro' });
      await criarTarefa(testApp, ana, outro.id, { title: 'De outro projeto' });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Deste projeto' });

      const response = await exportar();

      expect(response.text).toContain('Deste projeto');
      expect(response.text).not.toContain('De outro projeto');
    });
  });

  describe('POST /projects/:projectId/tasks/import', () => {
    it('importa CSV puro (text/csv) e devolve a contagem', async () => {
      const response = await importarCsvPuro(fixture('tarefas-validas.csv'));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ created: 4, errors: [] });
      expect((await listarTudo()).map((t) => t.title)).toEqual([
        'Configurar CI',
        'Escrever testes',
        'Modelar o banco',
        'Publicar release',
      ]);
    });

    it('importa por multipart/form-data no campo "file"', async () => {
      const response = await importarArquivo(fixture('tarefas-validas.csv'));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ created: 4, errors: [] });
    });

    it('os dados de cada coluna são preservados (status, responsável, prazo, descrição)', async () => {
      await importarCsvPuro(fixture('tarefas-validas.csv'));

      const modelar = (await listarTudo()).find(
        (t) => t.title === 'Modelar o banco',
      );

      expect(modelar).toMatchObject({
        description: 'Definir tabelas e relacionamentos',
        status: 'em_andamento',
        assigneeId: bruno.id,
        dueDate: '2026-11-01',
      });
    });

    it('linhas inválidas voltam em errors[] com o número da linha, sem impedir as válidas', async () => {
      await criarUsuario(testApp, {
        name: 'Forasteiro',
        email: 'forasteiro@empresa.com',
      });
      const response = await importarCsvPuro(fixture('tarefas-com-erros.csv'));

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(2);
      expect(response.body.errors).toEqual([
        { row: 3, message: 'O título é obrigatório.' },
        {
          row: 4,
          message:
            'Status inválido: "feito". Use: pendente, em_andamento ou concluida.',
        },
        {
          row: 5,
          message:
            'Data limite inválida: 31/12/2026. Use o formato AAAA-MM-DD.',
        },
        { row: 6, message: 'Usuário não encontrado: fantasma@empresa.com.' },
        {
          row: 7,
          message:
            'Responsável não é membro do projeto: forasteiro@empresa.com.',
        },
      ]);
      expect((await listarTudo()).map((t) => t.title)).toEqual([
        'Linha válida 1',
        'Linha válida 2',
      ]);
    });

    it('arquivo só com erros não cria nada', async () => {
      const response = await importarCsvPuro(
        `${CABECALHO}\n,sem título,pendente,,\n`,
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        created: 0,
        errors: [{ row: 2, message: 'O título é obrigatório.' }],
      });
      expect(await listarTudo()).toEqual([]);
    });

    it('a última linha do arquivo vira a tarefa mais recente (created_at crescente)', async () => {
      await importarCsvPuro(
        `${CABECALHO}\nPrimeira,,,,\nSegunda,,,,\nTerceira,,,,\n`,
      );

      const response = await testApp
        .http()
        .get(url(`/projects/${projeto.id}/tasks`))
        .set(...bearer(ana.token));

      expect(response.body.data.map((t: { title: string }) => t.title)).toEqual(
        ['Terceira', 'Segunda', 'Primeira'],
      );
    });

    it('aceita arquivo com BOM, espaços ao redor e e-mail com outra caixa', async () => {
      const csv = `﻿${CABECALHO}\n  Com BOM  , desc ,CONCLUIDA, Bruno@Empresa.COM ,2026-01-31\n`;

      const response = await importarArquivo(csv);

      expect(response.body).toEqual({ created: 1, errors: [] });
      expect(await listarTudo()).toEqual([
        expect.objectContaining({
          title: 'Com BOM',
          status: 'concluida',
          assigneeId: bruno.id,
          dueDate: '2026-01-31',
        }),
      ]);
    });

    it('aceita variações de escrita no status (maiúsculas, espaços e acentos)', async () => {
      const response = await importarCsvPuro(
        `${CABECALHO}\nA,,Em Andamento,,\nB,,em andamento,,\nC,, PENDENTE ,,\nD,,Concluída,,\nE,,concluida,,\n`,
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ created: 5, errors: [] });
      expect((await listarTudo()).map((t) => [t.title, t.status])).toEqual([
        ['A', 'em_andamento'],
        ['B', 'em_andamento'],
        ['C', 'pendente'],
        ['D', 'concluida'],
        ['E', 'concluida'],
      ]);
    });

    it('cabeçalho sem a coluna "titulo" devolve 400 e não importa nada', async () => {
      const response = await importarArquivo('foo,bar\n1,2\n3,4\n');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Cabeçalho inválido: o CSV precisa ter a coluna "titulo" ' +
          '(colunas aceitas: titulo, descricao, status, responsavel_email, data_limite).',
      );
      expect(await listarTudo()).toEqual([]);
    });

    it('aceita cabeçalho com acentos e maiúsculas e ignora colunas desconhecidas', async () => {
      const response = await importarCsvPuro(
        'Título,Descrição,Status,Data limite,observacao\nCom acento,desc,Pendente,2026-03-01,ignorada\n',
      );

      expect(response.body).toEqual({ created: 1, errors: [] });
      expect(await listarTudo()).toEqual([
        expect.objectContaining({
          title: 'Com acento',
          description: 'desc',
          dueDate: '2026-03-01',
        }),
      ]);
    });

    it.each([
      [
        'imagem PNG',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]),
      ],
      ['JSON', Buffer.from('[{"titulo": "A"}]', 'utf8')],
    ])('arquivo que não é CSV (%s) devolve 400 com mensagem clara', async (_nome, conteudo) => {
      const response = await importarArquivo(conteudo);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(MENSAGEM_NAO_CSV);
      expect(await listarTudo()).toEqual([]);
    });

    it('arquivo só com o cabeçalho devolve 400 explicando que não há linhas', async () => {
      const response = await importarArquivo(`${CABECALHO}\n`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'O arquivo enviado não parece ser um CSV válido: não há nenhuma linha de tarefa depois do cabeçalho.',
      );
    });

    it('quem não é membro recebe 404 antes de o arquivo ser analisado (não aprende nada sobre ele)', async () => {
      const intruso = await criarUsuario(testApp, { name: 'Intruso' });

      const response = await importarArquivo('foo,bar\n1,2\n', projeto.id, intruso);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Projeto não encontrado.');
    });

    it('sem arquivo nem corpo devolve 400 com orientação', async () => {
      const response = await testApp
        .http()
        .post(url(`/projects/${projeto.id}/tasks/import`))
        .set(...bearer(ana.token));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Envie o CSV no corpo da requisição (text/csv) ou no campo file (multipart/form-data).',
      );
    });

    it('arquivo vazio (0 bytes, só espaços ou corpo text/csv vazio) devolve 400 "O arquivo enviado está vazio."', async () => {
      const arquivoZeroBytes = await importarArquivo(Buffer.alloc(0));
      const arquivoEspacos = await importarArquivo('  \n ');
      const corpoEspacos = await importarCsvPuro('   \n  ');
      const corpoVazio = await testApp
        .http()
        .post(url(`/projects/${projeto.id}/tasks/import`))
        .set(...bearer(ana.token))
        .set('Content-Type', 'text/csv')
        .send('');

      for (const response of [arquivoZeroBytes, arquivoEspacos, corpoEspacos, corpoVazio]) {
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('O arquivo enviado está vazio.');
      }
      expect(await listarTudo()).toEqual([]);
    });

    it('arquivo vazio: projeto alheio e inexistente recebem a mesma resposta (nada vaza, D-027)', async () => {
      const intruso = await criarUsuario(testApp, { name: 'Intruso' });

      const alheio = await importarArquivo(Buffer.alloc(0), projeto.id, intruso);
      const inexistente = await importarArquivo(Buffer.alloc(0), randomUUID(), intruso);

      expect(alheio.status).toBe(inexistente.status);
      expect(alheio.body.message).toBe(inexistente.body.message);
    });

    it('multipart com o arquivo no campo errado devolve 400 em português', async () => {
      const response = await testApp
        .http()
        .post(url(`/projects/${projeto.id}/tasks/import`))
        .set(...bearer(ana.token))
        .attach('anexo', Buffer.from(`${CABECALHO}\nA,,,,\n`), 'tarefas.csv');

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Campo de arquivo inesperado. Envie o arquivo no campo "file".',
      );
    });

    it('arquivo acima de 5 MB devolve 413', async () => {
      const grande = Buffer.alloc(5 * 1024 * 1024 + 1, 'a');

      const response = await importarArquivo(grande);

      expect(response.status).toBe(413);
      expect(response.body.message).toBe(
        'O arquivo excede o tamanho máximo permitido de 5 MB.',
      );
    });

    it('viewer não importa (403), mas exporta (200)', async () => {
      const leitor = await criarUsuario(testApp, { name: 'Leitor' });
      await adicionarMembro(
        testApp,
        ana,
        projeto.id,
        leitor,
        ProjectRole.Viewer,
      );

      const importacao = await importarCsvPuro(
        fixture('tarefas-validas.csv'),
        projeto.id,
        leitor,
      );
      const exportacao = await exportar(projeto.id, leitor);

      expect(importacao.status).toBe(403);
      expect(exportacao.status).toBe(200);
      expect(await listarTudo()).toEqual([]);
    });

    it('sem token devolve 401 na exportação e na importação', async () => {
      const exportacao = await testApp
        .http()
        .get(url(`/projects/${projeto.id}/tasks/export`));
      const importacao = await testApp
        .http()
        .post(url(`/projects/${projeto.id}/tasks/import`))
        .set('Content-Type', 'text/csv')
        .send(fixture('tarefas-validas.csv'));

      expect(exportacao.status).toBe(401);
      expect(importacao.status).toBe(401);
    });
  });

  describe('exportar -> importar de volta', () => {
    it('preserva a ordem relativa das tarefas: a lista da cópia fica igual à do original (D-020)', async () => {
      for (const titulo of ['Primeira', 'Segunda', 'Terceira']) {
        await criarTarefa(testApp, ana, projeto.id, { title: titulo });
      }
      const lista = async (projectId: string) =>
        (
          await testApp
            .http()
            .get(url(`/projects/${projectId}/tasks`))
            .set(...bearer(ana.token))
        ).body.data.map((t: { title: string }) => t.title);
      const original = await exportar();

      const copia = await criarProjeto(testApp, ana, { name: 'Cópia' });
      await importarArquivo(original.text, copia.id);

      expect(
        (parse(original.text, { columns: true, bom: true }) as Array<Record<string, string>>).map(
          (linha) => linha['titulo'],
        ),
      ).toEqual(['Primeira', 'Segunda', 'Terceira']);
      expect(await lista(projeto.id)).toEqual(['Terceira', 'Segunda', 'Primeira']);
      expect(await lista(copia.id)).toEqual(['Terceira', 'Segunda', 'Primeira']);
    });

    const ordenar = (linhas: Array<Record<string, string>>) =>
      [...linhas].sort((a, b) =>
        (a['titulo'] ?? '').localeCompare(b['titulo'] ?? ''),
      );

    it('preserva os dados, inclusive vírgulas, aspas, quebras de linha e acentos', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Título, com "aspas" e vírgula',
        description: 'Linha 1\nLinha 2 com ação, ç e ñ',
        status: TaskStatus.Concluida,
        assigneeId: bruno.id,
        dueDate: '2026-12-31',
      });
      await criarTarefa(testApp, ana, projeto.id, { title: 'Só o título' });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Em andamento',
        status: TaskStatus.EmAndamento,
        assigneeId: ana.id,
      });
      const original = await exportar();

      const copia = await criarProjeto(testApp, ana, { name: 'Cópia' });
      await adicionarMembro(testApp, ana, copia.id, bruno, ProjectRole.Member);
      const importacao = await importarCsvPuro(original.text, copia.id);
      const reexportado = await exportar(copia.id);

      expect(importacao.body).toEqual({ created: 3, errors: [] });
      const linhasOriginais = parse(original.text, { columns: true, bom: true }) as Array<
        Record<string, string>
      >;
      const linhasCopia = parse(reexportado.text, { columns: true, bom: true }) as Array<
        Record<string, string>
      >;
      expect(ordenar(linhasCopia)).toEqual(ordenar(linhasOriginais));
    });

    it('exportar de novo depois de importar gera o mesmo conteúdo (por multipart também)', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'A',
        description: 'x, y',
        dueDate: '2026-02-01',
      });
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'B',
        assigneeId: bruno.id,
      });
      const original = await exportar();

      const copia = await criarProjeto(testApp, ana, { name: 'Cópia' });
      await adicionarMembro(testApp, ana, copia.id, bruno, ProjectRole.Member);
      await importarArquivo(original.text, copia.id);
      const reexportado = await exportar(copia.id);

      expect(ordenar(parse(reexportado.text, { columns: true, bom: true }))).toEqual(
        ordenar(parse(original.text, { columns: true, bom: true })),
      );
    });
  });
});
