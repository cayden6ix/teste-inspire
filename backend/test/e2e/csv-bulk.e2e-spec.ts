import { randomUUID } from 'node:crypto';
import type { DeepPartial } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { ProjectRole } from '../../src/common/enums/project-role.enum.js';
import { TaskStatus } from '../../src/common/enums/task-status.enum.js';
import { Task } from '../../src/modules/tasks/entities/task.entity.js';
import { TasksRepository } from '../../src/modules/tasks/repositories/tasks.repository.js';
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
import { contarQueries } from '../utils/queries.js';

const CABECALHO = 'titulo,descricao,status,responsavel_email,data_limite';

const contarTarefas = async (testApp: TestApp, projectId: string) =>
  Number(
    (
      (await testApp.dataSource.query(
        'SELECT count(*) AS n FROM tasks WHERE project_id = $1',
        [projectId],
      )) as Array<{ n: string }>
    )[0]?.n,
  );

describe('CSV em lote e proteção de fórmulas (e2e)', () => {
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
    projeto = await criarProjeto(testApp, ana, { name: 'Lote' });
    await adicionarMembro(testApp, ana, projeto.id, bruno, ProjectRole.Member);
  });

  const importar = (csv: string, projectId = projeto.id, usuario = ana) =>
    testApp
      .http()
      .post(url(`/projects/${projectId}/tasks/import`))
      .set(...bearer(usuario.token))
      .set('Content-Type', 'text/csv')
      .send(csv);

  const exportar = (projectId = projeto.id) =>
    testApp
      .http()
      .get(url(`/projects/${projectId}/tasks/export`))
      .set(...bearer(ana.token));

  /** CSV com `linhas` tarefas válidas, alternando responsáveis, status e prazos. */
  function gerarCsv(linhas: number): string {
    const status = ['pendente', 'em_andamento', 'concluida'];
    const responsaveis = ['ana@empresa.com', 'bruno@empresa.com', ''];
    const corpo: string[] = [];
    for (let i = 1; i <= linhas; i += 1) {
      const prazo = i % 2 === 0 ? '2026-12-31' : '';
      corpo.push(
        `Tarefa ${i},Descrição ${i},${status[i % 3]},${responsaveis[i % 3]},${prazo}`,
      );
    }
    return [CABECALHO, ...corpo].join('\n');
  }

  describe('R07: importação em lote', () => {
    it('importa 2000 linhas de uma vez, na ordem do arquivo e com os dados corretos', async () => {
      const response = await importar(gerarCsv(2000));

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ created: 2000, errors: [] });
      expect(await contarTarefas(testApp, projeto.id)).toBe(2000);

      const [primeira] = (await testApp.dataSource.query(
        `SELECT title, status, assignee_id, due_date::text AS due FROM tasks
         WHERE project_id = $1 AND title = 'Tarefa 2'`,
        [projeto.id],
      )) as Array<{
        title: string;
        status: string;
        assignee_id: string;
        due: string;
      }>;
      expect(primeira).toMatchObject({
        status: 'concluida',
        assignee_id: null,
        due: '2026-12-31',
      });
      const [comResponsavel] = (await testApp.dataSource.query(
        `SELECT assignee_id FROM tasks WHERE project_id = $1 AND title = 'Tarefa 1'`,
        [projeto.id],
      )) as Array<{ assignee_id: string }>;
      expect(comResponsavel?.assignee_id).toBe(bruno.id);

      // created_at crescente: a última linha do arquivo é a mais nova.
      const ultima = await testApp
        .http()
        .get(url(`/projects/${projeto.id}/tasks?limit=1`))
        .set(...bearer(ana.token));
      expect(ultima.body.data[0].title).toBe('Tarefa 2000');
    });

    it('aceita exatamente o limite de 5000 linhas', async () => {
      const response = await importar(gerarCsv(5000));

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(5000);
      expect(await contarTarefas(testApp, projeto.id)).toBe(5000);
    });

    it('5001 linhas devolvem 400 e nada é gravado', async () => {
      const response = await importar(gerarCsv(5001));

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'O arquivo excede o limite de 5000 linhas por importação.',
      );
      expect(await contarTarefas(testApp, projeto.id)).toBe(0);
    });

    it('as linhas inválidas não contam como criadas, mas contam para o limite de linhas', async () => {
      const linhas = Array.from(
        { length: 5001 },
        () => ',sem título,pendente,,',
      );

      const response = await importar([CABECALHO, ...linhas].join('\n'));

      expect(response.status).toBe(400);
    });

    it('sem N+1: o número de queries não depende da quantidade de linhas nem de responsáveis', async () => {
      const pequeno = await contarQueries(testApp.dataSource, () =>
        importar(gerarCsv(10)),
      );
      const grande = await contarQueries(testApp.dataSource, () =>
        importar(gerarCsv(2000)),
      );

      expect(pequeno.resultado.body.created).toBe(10);
      expect(grande.resultado.body.created).toBe(2000);
      // 2000 linhas / 500 por lote = 4 INSERTs a mais que o de 10 linhas.
      expect(
        grande.queries.length - pequeno.queries.length,
      ).toBeLessThanOrEqual(4);
      expect(grande.queries.length).toBeLessThan(30);
      // Nenhuma query de usuário ou membro por linha.
      const buscasPorLinha = grande.queries.filter(
        (q) => /FROM "users"/.test(q) || /FROM "project_members"/.test(q),
      );
      expect(buscasPorLinha.length).toBeLessThanOrEqual(6);
    });

    it('com e-mails inexistentes e de não-membros em milhares de linhas, ainda não faz uma query por linha', async () => {
      await criarUsuario(testApp, { email: 'forasteiro@empresa.com' });
      const linhas = Array.from(
        { length: 1500 },
        (_, i) =>
          `T${i},,pendente,${i % 2 === 0 ? 'forasteiro@empresa.com' : 'fantasma@empresa.com'},`,
      );

      const { resultado, queries } = await contarQueries(
        testApp.dataSource,
        () => importar([CABECALHO, ...linhas].join('\n')),
      );

      expect(resultado.body.created).toBe(0);
      expect(resultado.body.errors).toHaveLength(1500);
      expect(resultado.body.errors[0]).toEqual({
        row: 2,
        message: 'Responsável não é membro do projeto: forasteiro@empresa.com.',
      });
      expect(resultado.body.errors[1]).toEqual({
        row: 3,
        message: 'Usuário não encontrado: fantasma@empresa.com.',
      });
      expect(queries.length).toBeLessThan(15);
    });

    it('2000 linhas importam em tempo razoável (menos de 10 s)', async () => {
      const inicio = Date.now();

      await importar(gerarCsv(2000));

      expect(Date.now() - inicio).toBeLessThan(10_000);
    });

    it('a importação é transacional: se um lote falha, os lotes anteriores são desfeitos', async () => {
      const repositorio = testApp.app.get(TasksRepository);
      const tarefas: DeepPartial<Task>[] = Array.from(
        { length: 1200 },
        (_, i) => ({
          projectId: projeto.id,
          title: `Lote ${i}`,
          description: null,
          status: TaskStatus.Pendente,
          // Linha 1100 (3º lote de 500): responsável inexistente viola a FK.
          assigneeId: i === 1100 ? randomUUID() : null,
          dueDate: null,
        }),
      );

      await expect(repositorio.insertInBatches(tarefas)).rejects.toThrow();

      expect(await contarTarefas(testApp, projeto.id)).toBe(0);
    });

    it('título acima de 200 e descrição acima de 4000 caracteres viram erro de linha, não um 500', async () => {
      const csv = [
        CABECALHO,
        'Boa 1,,,,',
        `${'A'.repeat(201)},,,,`,
        `Descrição enorme,${'d'.repeat(4001)},,,`,
        'Boa 2,,,,',
      ].join('\n');

      const response = await importar(csv);

      expect(response.status).toBe(201);
      expect(response.body.created).toBe(2);
      expect(response.body.errors).toEqual([
        { row: 3, message: 'O título deve ter no máximo 200 caracteres.' },
        { row: 4, message: 'A descrição deve ter no máximo 4000 caracteres.' },
      ]);
    });

    it('aceita título com exatamente 200 e descrição com exatamente 4000 caracteres', async () => {
      const csv = [CABECALHO, `${'T'.repeat(200)},${'d'.repeat(4000)},,,`].join(
        '\n',
      );

      const response = await importar(csv);

      expect(response.body).toEqual({ created: 1, errors: [] });
    });

    it.each(['2026-02-30', '2026-13-01', '2025-02-29', '2026-04-31'])(
      'a data inexistente %s vira erro de linha',
      async (data) => {
        const csv = [CABECALHO, 'Boa,,,,2026-05-05', `Ruim,,,,${data}`].join(
          '\n',
        );

        const response = await importar(csv);

        expect(response.status).toBe(201);
        expect(response.body.created).toBe(1);
        expect(response.body.errors).toEqual([
          {
            row: 3,
            message: `Data limite inválida: ${data}. Use o formato AAAA-MM-DD.`,
          },
        ]);
      },
    );

    it('aceita 29 de fevereiro em ano bissexto', async () => {
      const response = await importar(
        [CABECALHO, 'Bissexta,,,,2028-02-29'].join('\n'),
      );

      expect(response.body).toEqual({ created: 1, errors: [] });
    });
  });

  describe('R08: fórmulas neutralizadas na exportação e restauradas na importação', () => {
    const TEXTOS_PERIGOSOS = [
      '=1+1',
      '+55 11 99999-0000',
      '-5 graus',
      '@SUM(A1:A9)',
      "'=já com apóstrofo",
      '=HYPERLINK("http://mal.example","clique")',
    ];

    it('a exportação prefixa apóstrofo em títulos e descrições que começam com =, +, - ou @', async () => {
      for (const texto of TEXTOS_PERIGOSOS) {
        await criarTarefa(testApp, ana, projeto.id, {
          title: texto,
          description: texto,
        });
      }

      const response = await exportar();

      const linhas = parse(response.text, { columns: true }) as Array<
        Record<string, string>
      >;
      expect(linhas).toHaveLength(TEXTOS_PERIGOSOS.length);
      for (const linha of linhas) {
        expect(linha['titulo']).toMatch(/^'+[=+\-@]/);
        expect(linha['descricao']).toMatch(/^'+[=+\-@]/);
        expect(linha['titulo']).not.toMatch(/^[=+\-@]/);
      }
    });

    it('o e-mail do responsável e os demais campos não são afetados', async () => {
      await criarTarefa(testApp, ana, projeto.id, {
        title: '=cmd',
        assigneeId: bruno.id,
        dueDate: '2026-12-31',
      });

      const [linha] = parse((await exportar()).text, {
        columns: true,
      }) as Array<Record<string, string>>;

      expect(linha).toMatchObject({
        responsavel_email: 'bruno@empresa.com',
        data_limite: '2026-12-31',
        status: 'pendente',
      });
    });

    it('ciclo exportar -> importar: os dados voltam idênticos ao original', async () => {
      for (const texto of TEXTOS_PERIGOSOS) {
        await criarTarefa(testApp, ana, projeto.id, {
          title: texto,
          description: `desc ${texto}`,
        });
      }
      await criarTarefa(testApp, ana, projeto.id, {
        title: 'Normal',
        description: '=só na descrição',
      });
      const original = await exportar();
      const copia = await criarProjeto(testApp, ana, { name: 'Cópia' });

      const importacao = await importar(original.text, copia.id);

      expect(importacao.body).toEqual({
        created: TEXTOS_PERIGOSOS.length + 1,
        errors: [],
      });
      const lista = await testApp
        .http()
        .get(url(`/projects/${copia.id}/tasks?limit=100`))
        .set(...bearer(ana.token));
      const titulos = lista.body.data
        .map((t: { title: string }) => t.title)
        .sort();
      expect(titulos).toEqual([...TEXTOS_PERIGOSOS, 'Normal'].sort());
      const normal = lista.body.data.find(
        (t: { title: string }) => t.title === 'Normal',
      );
      expect(normal.description).toBe('=só na descrição');
    });

    it('o ciclo é estável: exportar a cópia gera o mesmo conteúdo do original, sem apóstrofos acumulados', async () => {
      for (const texto of TEXTOS_PERIGOSOS) {
        await criarTarefa(testApp, ana, projeto.id, { title: texto });
      }
      const original = await exportar();
      const copia1 = await criarProjeto(testApp, ana, { name: 'Cópia 1' });
      await importar(original.text, copia1.id);
      const segunda = await exportar(copia1.id);
      const copia2 = await criarProjeto(testApp, ana, { name: 'Cópia 2' });
      await importar(segunda.text, copia2.id);
      const terceira = await exportar(copia2.id);

      const ordenar = (texto: string) =>
        (parse(texto, { columns: true }) as Array<Record<string, string>>)
          .map((linha) => linha['titulo'])
          .sort();
      expect(ordenar(segunda.text)).toEqual(ordenar(original.text));
      expect(ordenar(terceira.text)).toEqual(ordenar(original.text));
    });

    it('um CSV de terceiros com fórmula crua é importado como texto e exportado já protegido', async () => {
      const csv = `${CABECALHO}\n=2+2,@alvo,pendente,,\n`;

      await importar(csv);
      const response = await exportar();

      const [linha] = parse(response.text, { columns: true }) as Array<
        Record<string, string>
      >;
      expect(linha?.['titulo']).toBe("'=2+2");
      expect(linha?.['descricao']).toBe("'@alvo");
    });
  });
});
