import { describe, expect, it } from 'vitest';
import { APP_TITLE, formatDocumentTitle } from './useDocumentTitle';

describe('formatDocumentTitle (TRV-25)', () => {
  it('título da página seguido do nome da aplicação', () => {
    expect(formatDocumentTitle('Projetos')).toBe('Projetos · Gestão de Projetos e Tarefas');
    expect(formatDocumentTitle('Tarefas — Portal do Cliente')).toBe(
      'Tarefas — Portal do Cliente · Gestão de Projetos e Tarefas',
    );
  });

  it('sem título de página, só o nome da aplicação', () => {
    expect(formatDocumentTitle()).toBe(APP_TITLE);
    expect(formatDocumentTitle(null)).toBe(APP_TITLE);
    expect(formatDocumentTitle('   ')).toBe(APP_TITLE);
  });

  it('normaliza espaços (nomes de projeto vêm do usuário)', () => {
    expect(formatDocumentTitle('  Tarefas —   Meu\n projeto ')).toBe(
      'Tarefas — Meu projeto · Gestão de Projetos e Tarefas',
    );
  });
});
