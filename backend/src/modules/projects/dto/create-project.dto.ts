import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator.js';

export class CreateProjectDto {
  @ApiProperty({ example: 'Projeto Alpha' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ example: 'Descricao opcional do projeto', nullable: true })
  @IsOptional()
  @Trim({ emptyToNull: true })
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
