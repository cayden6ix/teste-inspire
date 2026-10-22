import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional } from 'class-validator';

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    example: 'ana@exemplo.com',
    description: 'Filtra os usuarios por email (busca parcial, sem diferenciar maiusculas)',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}
