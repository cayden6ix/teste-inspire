import { escapeLike } from './like.util.js';

describe('escapeLike', () => {
  it('escapa os curingas % e _', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
  });

  it('escapa a própria barra invertida', () => {
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });

  it('escapa todas as ocorrências, na ordem correta', () => {
    expect(escapeLike('%_\\%')).toBe('\\%\\_\\\\\\%');
  });

  it('não altera texto comum, acentos nem vazio', () => {
    expect(escapeLike('Relatório de ação')).toBe('Relatório de ação');
    expect(escapeLike('')).toBe('');
  });
});
