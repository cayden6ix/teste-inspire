import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    example: 'ana@exemplo.com',
    description: 'Filtra os usuarios por email (busca parcial, sem diferenciar maiusculas)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;
}
