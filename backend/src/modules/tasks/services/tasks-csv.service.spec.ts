import { parse } from 'csv-parse/sync';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import type { Task } from '../entities/task.entity.js';
import { TasksCsvService } from './tasks-csv.service.js';

function tarefa(dados: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    description: null,
    status: TaskStatus.Pendente,
    assignee: null,
    dueDate: null,
    ...dados,
  } as Task;
}

describe('TasksCsvService', () => {
  const service = new TasksCsvService();

  describe('toCsv', () => {
    it('gera apenas o cabeçalho quando não há tarefas', () => {
      expect(service.toCsv([])).toBe(
        'titulo,descricao,status,responsavel_email,data_limite\n',
      );
    });

    it('exporta as colunas na ordem do contrato', () => {
      const csv = service.toCsv([
        tarefa({
          title: 'Modelar o banco',
          description: 'Definir tabelas',
          status: TaskStatus.EmAndamento,
          assignee: { email: 'bruno@empresa.com' } as Task['assignee'],
          dueDate: '2026-11-01',
        }),
      ]);

      expect(csv).toBe(
        'titulo,descricao,status,responsavel_email,data_limite\n' +
          'Modelar o banco,Definir tabelas,em_andamento,bruno@empresa.com,2026-11-01\n',
      );
    });

    it('usa texto vazio para descrição, responsável e data ausentes', () => {
      const csv = service.toCsv([tarefa({ title: 'Sem detalhes' })]);

      expect(csv.split('\n')[1]).toBe('Sem detalhes,,pendente,,');
    });

    it('escapa vírgulas, aspas e quebras de linha de modo que o parse devolve o texto original', () => {
      const original = tarefa({
        title: 'Título, com vírgula',
        description: 'Ele disse "oi"\nsegunda linha',
      });

      const csv = service.toCsv([original]);

      expect(csv).toContain('"Título, com vírgula"');
      expect(csv).toContain('"Ele disse ""oi""\nsegunda linha"');
      const [linha] = parse(csv, { columns: true }) as Array<
        Record<string, string>
      >;
      expect(linha?.['titulo']).toBe('Título, com vírgula');
      expect(linha?.['descricao']).toBe('Ele disse "oi"\nsegunda linha');
    });
  });

  describe('parse', () => {
    it('devolve lista vazia para texto vazio ou só espaços', () => {
      expect(service.parse('')).toEqual([]);
      expect(service.parse('  \n \n')).toEqual([]);
    });

    it('devolve lista vazia quando há só o cabeçalho', () => {
      expect(
        service.parse(
          'titulo,descricao,status,responsavel_email,data_limite\n',
        ),
      ).toEqual([]);
    });

    it('lê as linhas indexadas pelo cabeçalho e ignora linhas vazias', () => {
      const rows = service.parse(
        'titulo,descricao,status\n' +
          'A,primeira,pendente\n' +
          '\n' +
          'B,segunda,concluida\n',
      );

      expect(rows).toEqual([
        { titulo: 'A', descricao: 'primeira', status: 'pendente' },
        { titulo: 'B', descricao: 'segunda', status: 'concluida' },
      ]);
    });

    it('remove espaços ao redor dos valores e o BOM do início do arquivo', () => {
      const rows = service.parse('﻿titulo,status\n  Com espaço  , pendente \n');

      expect(rows).toEqual([{ titulo: 'Com espaço', status: 'pendente' }]);
    });

    it('aceita campos entre aspas com vírgula e quebra de linha', () => {
      const rows = service.parse(
        'titulo,descricao\n"A, B","linha 1\nlinha 2"\n',
      );

      expect(rows).toEqual([{ titulo: 'A, B', descricao: 'linha 1\nlinha 2' }]);
    });
  });
});

describe('TasksCsvService: proteção contra injeção de fórmula (R08)', () => {
  const service = new TasksCsvService();

  const exportado = (dados: Partial<Task>) =>
    (
      parse(service.toCsv([tarefa(dados)]), { columns: true }) as Array<
        Record<string, string>
      >
    )[0] ?? {};

  it.each(['=1+1', '+cmd|calc', '-2+3', '@SUM(A1)', '\tabc', '\rabc'])(
    'prefixa com apóstrofo o valor %j no título, na descrição e no e-mail',
    (valor) => {
      const linha = exportado({
        title: valor,
        description: valor,
        assignee: { email: valor } as Task['assignee'],
      });

      expect(linha['titulo']).toBe(`'${valor}`);
      expect(linha['descricao']).toBe(`'${valor}`);
      expect(linha['responsavel_email']).toBe(`'${valor}`);
    },
  );

  it('não altera valores comuns, nem os que têm esses caracteres no meio', () => {
    const linha = exportado({
      title: 'Soma 1+1 = 2 @ casa',
      description: "Item 'entre aspas'",
    });

    expect(linha['titulo']).toBe('Soma 1+1 = 2 @ casa');
    expect(linha['descricao']).toBe("Item 'entre aspas'");
  });

  it('não mexe em status e data limite (gerados pelo sistema)', () => {
    const linha = exportado({ dueDate: '2026-11-01' });

    expect(linha['status']).toBe('pendente');
    expect(linha['data_limite']).toBe('2026-11-01');
  });

  it('a importação remove UM apóstrofo antes de =, +, -, @, tab e CR', () => {
    const rows = service.parse(
      "titulo,descricao\n'=1+1,'+x\n'-2,'@a\n\"'\t tab\",\"'\rcr\"\n",
    );

    expect(rows.map((row) => row['titulo'])).toEqual(['=1+1', '-2', '\t tab']);
    expect(rows.map((row) => row['descricao'])).toEqual(['+x', '@a', '\rcr']);
  });

  it('a importação não remove apóstrofo de texto comum', () => {
    const rows = service.parse("titulo,descricao\n'normal,it's fine\n");

    expect(rows).toEqual([{ titulo: "'normal", descricao: "it's fine" }]);
  });

  it.each([
    '=1+1',
    '+55 11 99999',
    '-5 graus',
    '@fulano',
    "'=já tinha apóstrofo",
    "''@dois",
    '\tcom tab',
    '\rcom CR',
    'texto normal',
  ])('ciclo exportar -> importar devolve exatamente %j', (valor) => {
    const csv = service.toCsv([tarefa({ title: valor, description: valor })]);

    const [linha] = service.parse(csv);

    expect(linha?.['titulo']).toBe(valor);
    expect(linha?.['descricao']).toBe(valor);
  });
});
