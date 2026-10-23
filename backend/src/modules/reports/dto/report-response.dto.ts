import { ApiProperty } from '@nestjs/swagger';
import { ReportGroupBy } from './reports-query.dto.js';

/**
 * Contagem de tarefas por status (D-012).
 */
export class ReportByStatusDto {
  @ApiProperty({ example: 2 })
  pendente: number;

  @ApiProperty({ example: 1 })
  em_andamento: number;

  @ApiProperty({ example: 4 })
  concluida: number;
}

/**
 * Grupo do relatorio: por status (`key` = status) ou por usuario (`key` = id).
 */
export class ReportGroupDto {
  @ApiProperty({ example: 'em_andamento', description: 'Status ou id do responsavel (sem_responsavel se vazio)' })
  key: string;

  @ApiProperty({ example: 'em_andamento', description: 'Nome exibido: status ou nome do responsavel' })
  label: string;

  @ApiProperty({ example: 1 })
  count: number;
}

export class ReportResponseDto {
  @ApiProperty({ enum: [ReportGroupBy.Status, ReportGroupBy.User] })
  groupBy: ReportGroupBy;

  @ApiProperty({ example: 7, description: 'Total de tarefas consideradas' })
  total: number;

  @ApiProperty({ type: () => ReportByStatusDto })
  byStatus: ReportByStatusDto;

  @ApiProperty({ type: () => [ReportGroupDto] })
  groups: ReportGroupDto[];
}
