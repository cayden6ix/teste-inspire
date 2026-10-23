import { describe, expect, it } from 'vitest';
import type { Task, TaskStatus } from '@/types/task';
import {
  BOARD_COLUMN_PAGE,
  buildColumns,
  columnWindow,
  isTaskDrag,
  leftColumn,
  TASK_DRAG_TYPE,
} from './board';

function tarefa(id: string, status: TaskStatus, createdAt: string): Task {
  return {
    id,
    projectId: 'p',
    title: id,
    description: null,
    status,
    assigneeId: null,
    assigneeName: null,
    dueDate: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe('buildColumns', () => {
  const tarefas = [
    tarefa('antiga', 'pendente', '2026-01-01T10:00:00.000Z'),
    tarefa('nova', 'pendente', '2026-03-01T10:00:00.000Z'),
    tarefa('feita', 'concluida', '2026-02-01T10:00:00.000Z'),
  ];

  it('uma coluna por status, na ordem do fluxo, mais recentes primeiro', () => {
    const colunas = buildColumns(tarefas, {});

    expect(colunas.map((coluna) => coluna.status)).toEqual(['pendente', 'em_andamento', 'concluida']);
    expect(colunas[0]?.tasks.map((t) => t.id)).toEqual(['nova', 'antiga']);
    expect(colunas[1]?.tasks).toEqual([]);
    expect(colunas[2]?.tasks.map((t) => t.id)).toEqual(['feita']);
  });

  it('aplica a mudança otimista (cartão arrastado) com o novo status', () => {
    const colunas = buildColumns(tarefas, { antiga: 'em_andamento' });

    expect(colunas[0]?.tasks.map((t) => t.id)).toEqual(['nova']);
    expect(colunas[1]?.tasks).toEqual([expect.objectContaining({ id: 'antiga', status: 'em_andamento' })]);
    expect(tarefas[0]?.status).toBe('pendente');
  });
});

describe('columnWindow (KAN-15)', () => {
  it('mostra no máximo o limite e informa quantos faltam', () => {
    expect(columnWindow(5047, BOARD_COLUMN_PAGE)).toEqual({ shown: 50, remaining: 4997 });
    expect(columnWindow(120, 100)).toEqual({ shown: 100, remaining: 20 });
    expect(columnWindow(30, BOARD_COLUMN_PAGE)).toEqual({ shown: 30, remaining: 0 });
    expect(columnWindow(0, BOARD_COLUMN_PAGE)).toEqual({ shown: 0, remaining: 0 });
  });
});

describe('arrastar para a coluna inteira (C6-06)', () => {
  it('só um arraste de cartão do quadro conta: texto arrastado de um campo não', () => {
    expect(isTaskDrag([TASK_DRAG_TYPE])).toBe(true);
    expect(isTaskDrag(['text/plain'])).toBe(false);
    expect(isTaskDrag(['text/plain', 'text/html'])).toBe(false);
    expect(isTaskDrag([])).toBe(false);
  });

  it('o tipo do arraste não é text/plain (o id não é inserido no campo "Nova tarefa")', () => {
    expect(TASK_DRAG_TYPE).not.toMatch(/^text\//);
  });

  it('dragleave entre filhos da coluna mantém o realce; sair da coluna desliga', () => {
    const filho = {} as Node;
    const fora = {} as Node;
    const coluna = { contains: (alvo: Node | null) => alvo === filho };

    expect(leftColumn(coluna, filho)).toBe(false);
    expect(leftColumn(coluna, fora)).toBe(true);
    expect(leftColumn(coluna, null)).toBe(true);
  });
});
