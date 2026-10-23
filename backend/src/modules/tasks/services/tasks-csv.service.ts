import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
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

  toCsv(tasks: Task[]): string {
    return stringify(
      tasks.map((task) => ({
        titulo: escapeFormula(task.title),
        descricao: escapeFormula(task.description ?? ''),
        status: task.status,
        responsavel_email: escapeFormula(task.assignee?.email ?? ''),
        data_limite: task.dueDate ?? '',
      })),
      { header: true, columns: [...TasksCsvService.COLUMNS] },
    );
  }

  /**
   * Le o CSV (com cabecalho) e devolve as linhas ja sem o escape de formula.
   */
  parse(csvText: string): CsvRow[] {
    if (!csvText.trim()) {
      return [];
    }

    const rows = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as CsvRow[];

    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([column, value]) => [column, unescapeFormula(value)]),
      ),
    );
  }
}

function escapeFormula(value: string): string {
  return FORMULA_LIKE_PATTERN.test(value) ? `'${value}` : value;
}

function unescapeFormula(value: string): string {
  return typeof value === 'string' && ESCAPED_FORMULA_PATTERN.test(value) ? value.slice(1) : value;
}
