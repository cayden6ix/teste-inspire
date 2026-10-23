import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator.js';

export class UpdateProjectDto {
  @ApiPropertyOptional({ example: 'Novo nome do projeto' })
  @IsOptional()
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'Nova descricao', nullable: true })
  @IsOptional()
  @Trim({ emptyToNull: true })
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
