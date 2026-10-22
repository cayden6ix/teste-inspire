import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum ReportGroupBy {
  Status = 'status',
  User = 'user',
}

export class ReportsQueryDto {
  @ApiPropertyOptional({ enum: [ReportGroupBy.Status, ReportGroupBy.User], default: ReportGroupBy.Status })
  @IsOptional()
  @IsEnum(ReportGroupBy)
  groupBy?: ReportGroupBy;

  @ApiPropertyOptional({ format: 'uuid', description: 'Filtra o relatorio por projeto' })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}
