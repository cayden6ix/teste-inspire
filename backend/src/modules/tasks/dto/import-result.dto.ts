import { ApiProperty } from '@nestjs/swagger';

/**
 * Linha do CSV rejeitada na importacao.
 */
export class ImportErrorDto {
  @ApiProperty({ example: 3, description: 'Numero da linha no CSV (1 = cabecalho)' })
  row: number;

  @ApiProperty({ example: 'Responsável não é membro do projeto: ana@empresa.com.' })
  message: string;
}

/**
 * Resultado da importacao: linhas validas sao criadas; as invalidas
 * nao interrompem o processo e voltam em `errors`.
 */
export class ImportResultDto {
  @ApiProperty({ example: 5, description: 'Quantidade de tarefas criadas' })
  created: number;

  @ApiProperty({ type: () => [ImportErrorDto] })
  errors: ImportErrorDto[];
}
