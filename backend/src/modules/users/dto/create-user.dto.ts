import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator.js';

export class CreateUserDto {
  @ApiProperty({ format: 'email', example: 'nova.pessoa@empresa.com', description: 'Email unico da conta' })
  @Trim({ lowercase: true })
  @IsEmail()
  email: string;

  @ApiProperty({ format: 'password', minLength: 6, example: 'Senha@123', description: 'Minimo de 6 caracteres' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'Nova Pessoa', description: 'Nome exibido nas telas e relatorios' })
  @Trim()
  @IsString()
  @IsNotEmpty()
  name: string;
}
