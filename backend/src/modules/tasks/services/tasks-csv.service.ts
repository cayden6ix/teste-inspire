import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { Task } from '../entities/task.entity.js';

export type CsvRow = Record<string, string>;

/**
 * Serializacao CSV das tarefas (D-014).
 *
 * Colunas: `titulo,descricao,status,responsavel_email,data_limite`.
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
        titulo: task.title,
        descricao: task.description ?? '',
        status: task.status,
        responsavel_email: task.assignee?.email ?? '',
        data_limite: task.dueDate ?? '',
      })),
      { header: true, columns: [...TasksCsvService.COLUMNS] },
    );
  }

  parse(csvText: string): CsvRow[] {
    if (!csvText.trim()) {
      return [];
    }

    return parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as CsvRow[];
  }
}
