import { describe, expect, it } from 'vitest';
import { csvFileProblem, EMPTY_CSV_FILE_MESSAGE, NO_CSV_FILE_MESSAGE } from './importFile';

describe('csvFileProblem (B2-03)', () => {
  it('sem arquivo pede para escolher um', () => {
    expect(csvFileProblem(null)).toBe(NO_CSV_FILE_MESSAGE);
  });

  it('arquivo de 0 bytes: explica o que o CSV precisa ter, sem chamar a API', () => {
    expect(csvFileProblem(new Blob([]))).toBe(EMPTY_CSV_FILE_MESSAGE);
    expect(EMPTY_CSV_FILE_MESSAGE).toBe(
      'O arquivo está vazio. Escolha um CSV com o cabeçalho (titulo,descricao,status,responsavel_email,data_limite) e ao menos uma linha.',
    );
  });

  it('arquivo com conteúdo segue para a API (que valida cabeçalho e linhas)', () => {
    expect(csvFileProblem(new Blob(['titulo\nA\n']))).toBeNull();
    expect(csvFileProblem(new Blob([' ']))).toBeNull();
  });
});
