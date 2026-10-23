import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_PASSWORD_MAX_LENGTH,
  USER_PASSWORD_MIN_LENGTH,
} from '../users.types.js';

export class CreateUserDto {
  @ApiProperty({
    format: 'email',
    maxLength: USER_EMAIL_MAX_LENGTH,
    example: 'nova.pessoa@empresa.com',
    description: 'Email unico da conta',
  })
  @Trim({ lowercase: true })
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email: string;

  @ApiProperty({
    format: 'password',
    minLength: USER_PASSWORD_MIN_LENGTH,
    maxLength: USER_PASSWORD_MAX_LENGTH,
    example: 'Senha@123',
    description: 'De 6 a 72 caracteres (limite do bcrypt)',
  })
  @IsString()
  @MinLength(USER_PASSWORD_MIN_LENGTH)
  @MaxLength(USER_PASSWORD_MAX_LENGTH)
  password: string;

  @ApiProperty({
    maxLength: USER_NAME_MAX_LENGTH,
    example: 'Nova Pessoa',
    description: 'Nome exibido nas telas e relatorios',
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name: string;
}
