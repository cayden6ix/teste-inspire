import { BadRequestException, Injectable } from '@nestjs/common';
import { CsvError, parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Task } from '../entities/task.entity.js';

export type CsvRow = Record<string, string>;

/**
 * Valor que o Excel/LibreOffice interpretaria como formula: comeca com `=`, `+`,
 * `-`, `@`, tab ou CR, opcionalmente precedido de apostrofos (que tambem sao
 * escapados, para o ciclo exportar -> importar ser reversivel).
 */
const FORMULA_LIKE_PATTERN = /^'*[=+\-@\t\r]/;

/** Valor exportado com o apostrofo de protecao (o inverso de `FORMULA_LIKE_PATTERN`). */
const ESCAPED_FORMULA_PATTERN = /^'+[=+\-@\t\r]/;

/** Byte Order Mark do UTF-8 (o Excel o usa para reconhecer a codificacao). */
const UTF8_BOM = '\uFEFF';

export const CSV_NOT_CSV_MESSAGE = 'O arquivo enviado não parece ser um CSV válido.';

export const CSV_NO_DATA_MESSAGE =
  'O arquivo enviado não parece ser um CSV válido: não há nenhuma linha de tarefa depois do cabeçalho.';

/**
 * Serializacao CSV das tarefas (D-014).
 *
 * Colunas: `titulo,descricao,status,responsavel_email,data_limite`.
 *
 * Protecao contra CSV/Formula Injection: na exportacao, um valor com cara de
 * formula ganha um apostrofo na frente (a planilha mostra o texto, sem executar).
 * Na importacao, um apostrofo inicial seguido desses caracteres e removido, de
 * modo que exportar e importar de volta preserva o texto original.
 */
@Injectable()
export class TasksCsvService {
  static readonly COLUMNS = [
    'titulo',
    'descricao',
    'status',
    'responsavel_email',
    'data_limite',
  ] as const;

  static readonly HEADER_INVALID_MESSAGE =
    'Cabeçalho inválido: o CSV precisa ter a coluna "titulo" ' +
    `(colunas aceitas: ${TasksCsvService.COLUMNS.join(', ')}).`;

  /**
   * CSV em UTF-8 COM BOM (D-030): o Excel em portugues so reconhece os acentos com ele.
   * A importacao aceita o arquivo com ou sem BOM.
   */
  toCsv(tasks: Task[]): string {
    return stringify(
      tasks.map((task) => ({
        titulo: escapeFormula(task.title),
        descricao: escapeFormula(task.description ?? ''),
        status: task.status,
        responsavel_email: escapeFormula(task.assignee?.email ?? ''),
        data_limite: task.dueDate ?? '',
      })),
      { header: true, bom: true, columns: [...TasksCsvService.COLUMNS] },
    );
  }

  /**
   * Le o CSV (com cabecalho) e devolve as linhas ja sem o escape de formula.
   *
   * Os nomes das colunas sao normalizados (`Título` vira `titulo`, `Data limite` vira
   * `data_limite`) e colunas desconhecidas sao ignoradas. Recusa com 400, antes de
   * importar qualquer linha (D-030):
   * - arquivo binario ou que nao e CSV (byte nulo, JSON, aspas quebradas);
   * - cabecalho sem a coluna `titulo`;
   * - nenhuma linha de dados depois do cabecalho.
   */
  parse(csvText: string): CsvRow[] {
    const text = csvText.startsWith(UTF8_BOM) ? csvText.slice(1) : csvText;

    if (text.includes('\u0000') || /^\s*[[{]/.test(text)) {
      throw new BadRequestException(CSV_NOT_CSV_MESSAGE);
    }

    let header: string[] = [];
    let rows: CsvRow[];

    try {
      rows = parse(text, {
        columns: (names: string[]) => {
          header = names.map(normalizeCsvKey);
          return header;
        },
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as CsvRow[];
    } catch (error) {
      if (error instanceof CsvError) {
        throw new BadRequestException(CSV_NOT_CSV_MESSAGE);
      }
      throw error;
    }

    if (!header.includes('titulo')) {
      throw new BadRequestException(TasksCsvService.HEADER_INVALID_MESSAGE);
    }

    if (rows.length === 0) {
      throw new BadRequestException(CSV_NO_DATA_MESSAGE);
    }

    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([column, value]) => [column, unescapeFormula(value)]),
      ),
    );
  }
}

/**
 * Chave comparavel de um nome de coluna ou de um status: sem espacos nas bordas, em
 * minusculas, sem acentos e com espacos/hifens trocados por `_`
 * (`' Em Andamento '` -> `em_andamento`, `Concluída` -> `concluida`, `Título` -> `titulo`).
 */
export function normalizeCsvKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s-]+/g, '_');
}

function escapeFormula(value: string): string {
  return FORMULA_LIKE_PATTERN.test(value) ? `'${value}` : value;
}

function unescapeFormula(value: string): string {
  return typeof value === 'string' && ESCAPED_FORMULA_PATTERN.test(value) ? value.slice(1) : value;
}
