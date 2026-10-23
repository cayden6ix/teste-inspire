import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import type { Task } from '../entities/task.entity.js';
import {
  CSV_EMPTY_FILE_MESSAGE,
  CSV_MISSING_FILE_MESSAGE,
  CSV_NO_DATA_MESSAGE,
  CSV_NOT_CSV_MESSAGE,
  normalizeCsvKey,
  resolveCsvUpload,
  TasksCsvService,
} from './tasks-csv.service.js';

const BOM = '\uFEFF';

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
    it('gera apenas o cabeçalho (com BOM) quando não há tarefas', () => {
      expect(service.toCsv([])).toBe(
        `${BOM}titulo,descricao,status,responsavel_email,data_limite\n`,
      );
    });

    it('começa com o BOM do UTF-8, para o Excel reconhecer os acentos (D-030)', () => {
      const csv = service.toCsv([tarefa({ title: 'Integração' })]);

      expect(Buffer.from(csv, 'utf8').subarray(0, 3)).toEqual(
        Buffer.from([0xef, 0xbb, 0xbf]),
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
        `${BOM}titulo,descricao,status,responsavel_email,data_limite\n` +
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
      const [linha] = parse(csv, { columns: true, bom: true }) as Array<
        Record<string, string>
      >;
      expect(linha?.['titulo']).toBe('Título, com vírgula');
      expect(linha?.['descricao']).toBe('Ele disse "oi"\nsegunda linha');
    });
  });

  describe('parse', () => {
    /** Mensagem do 400 lançado por `parse` (falha o teste se não lançar). */
    const erroDe = (texto: string): string => {
      try {
        service.parse(texto);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        return (error as BadRequestException).message;
      }
      throw new Error('parse deveria ter recusado o arquivo.');
    };

    it('recusa arquivo só com o cabeçalho: nenhuma linha de dados (D-030)', () => {
      expect(
        erroDe('titulo,descricao,status,responsavel_email,data_limite\n'),
      ).toBe(CSV_NO_DATA_MESSAGE);
    });

    it('recusa cabeçalho sem a coluna "titulo", listando as colunas aceitas', () => {
      expect(erroDe('foo,bar\n1,2\n')).toBe(
        'Cabeçalho inválido: o CSV precisa ter a coluna "titulo" ' +
          '(colunas aceitas: titulo, descricao, status, responsavel_email, data_limite).',
      );
      expect(erroDe('  \n \n')).toBe(TasksCsvService.HEADER_INVALID_MESSAGE);
      expect(erroDe('uma linha de texto qualquer')).toBe(
        TasksCsvService.HEADER_INVALID_MESSAGE,
      );
    });

    it.each([
      ['PNG (bytes nulos)', '\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR'],
      ['texto com byte nulo', 'titulo\nA\u0000B\n'],
      ['JSON (objeto)', '{"titulo": "A"}'],
      ['JSON (lista)', '  [{"titulo": "A"}]'],
      ['aspas quebradas', 'titulo,descricao\n"sem fechar,x\n'],
    ])('recusa arquivo que não é CSV: %s', (_nome, texto) => {
      expect(erroDe(texto)).toBe(CSV_NOT_CSV_MESSAGE);
    });

    it('normaliza os nomes das colunas (maiúsculas, acentos, espaços) e mantém as desconhecidas fora do uso', () => {
      const rows = service.parse(
        ' Título ,Descrição,STATUS,Responsável_Email,Data limite,extra\n' +
          'A,desc,pendente,ana@empresa.com,2026-11-01,ignorada\n',
      );

      expect(rows).toEqual([
        {
          titulo: 'A',
          descricao: 'desc',
          status: 'pendente',
          responsavel_email: 'ana@empresa.com',
          data_limite: '2026-11-01',
          extra: 'ignorada',
        },
      ]);
    });

    it('aceita de volta o arquivo exportado (com BOM): ciclo completo', () => {
      const csv = service.toCsv([
        tarefa({ title: 'Integração', description: 'Descrição' }),
      ]);

      expect(service.parse(csv)).toEqual([
        {
          titulo: 'Integração',
          descricao: 'Descrição',
          status: 'pendente',
          responsavel_email: '',
          data_limite: '',
        },
      ]);
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
      const rows = service.parse('\uFEFFtitulo,status\n  Com espaço  , pendente \n');

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

describe('normalizeCsvKey', () => {
  it.each([
    ['Em Andamento', 'em_andamento'],
    ['em andamento', 'em_andamento'],
    ['em-andamento', 'em_andamento'],
    [' PENDENTE ', 'pendente'],
    ['Concluída', 'concluida'],
    ['concluida', 'concluida'],
    ['Título', 'titulo'],
    ['Data   limite', 'data_limite'],
    ['', ''],
  ])('%j vira %j', (entrada, esperado) => {
    expect(normalizeCsvKey(entrada)).toBe(esperado);
  });
});

describe('TasksCsvService: proteção contra injeção de fórmula (R08)', () => {
  const service = new TasksCsvService();

  const exportado = (dados: Partial<Task>) =>
    (
      parse(service.toCsv([tarefa(dados)]), { columns: true, bom: true }) as Array<
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

describe('resolveCsvUpload (arquivo vazio x arquivo ausente, B2-03)', () => {
  const arquivo = (texto: string) => ({ buffer: Buffer.from(texto, 'utf8') });

  /** Mensagem do 400 lançado (falha o teste se não lançar). */
  const erroDe = (...args: Parameters<typeof resolveCsvUpload>): string => {
    try {
      resolveCsvUpload(...args);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      return (error as BadRequestException).message;
    }
    throw new Error('deveria ter recusado o envio.');
  };

  it('devolve o texto do arquivo multipart (com BOM intacto para o parse)', () => {
    expect(resolveCsvUpload(arquivo('\uFEFFtitulo\nA\n'), {}, 'multipart/form-data; boundary=x')).toBe(
      '\uFEFFtitulo\nA\n',
    );
  });

  it('devolve o corpo text/csv', () => {
    expect(resolveCsvUpload(undefined, 'titulo\nA\n', 'text/csv')).toBe('titulo\nA\n');
  });

  it.each([
    ['arquivo de 0 bytes', arquivo('')],
    ['arquivo só com BOM', arquivo('\uFEFF')],
    ['arquivo só com espaços e quebras de linha', arquivo('  \n \r\n')],
  ])('%s no campo file: "O arquivo enviado está vazio."', (_nome, file) => {
    expect(erroDe(file, {}, 'multipart/form-data; boundary=x')).toBe(CSV_EMPTY_FILE_MESSAGE);
  });

  it('corpo text/csv vazio (o body parser não roda e o corpo chega como {}) também é arquivo vazio', () => {
    expect(erroDe(undefined, {}, 'text/csv')).toBe(CSV_EMPTY_FILE_MESSAGE);
    expect(erroDe(undefined, {}, 'text/plain; charset=utf-8')).toBe(CSV_EMPTY_FILE_MESSAGE);
    expect(erroDe(undefined, '   ', 'text/csv')).toBe(CSV_EMPTY_FILE_MESSAGE);
  });

  it('sem arquivo e sem corpo CSV: orienta como enviar', () => {
    expect(erroDe(undefined, {}, undefined)).toBe(CSV_MISSING_FILE_MESSAGE);
    expect(erroDe(undefined, {}, 'application/json')).toBe(CSV_MISSING_FILE_MESSAGE);
    expect(erroDe(undefined, {}, 'multipart/form-data; boundary=x')).toBe(CSV_MISSING_FILE_MESSAGE);
  });
});
