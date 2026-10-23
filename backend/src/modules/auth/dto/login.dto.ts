import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import { USER_EMAIL_MAX_LENGTH, USER_PASSWORD_MAX_LENGTH } from '../../users/users.types.js';

export class LoginDto {
  @ApiProperty({
    format: 'email',
    maxLength: USER_EMAIL_MAX_LENGTH,
    example: 'ana.souza@empresa.com',
    description: 'Email cadastrado',
  })
  @Trim({ lowercase: true })
  @IsEmail()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email: string;

  /** O teto evita gastar hash bcrypt com textos enormes (nenhuma senha valida passa de 72). */
  @ApiProperty({
    format: 'password',
    maxLength: USER_PASSWORD_MAX_LENGTH,
    example: 'Senha@123',
    description: 'Senha da conta',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_PASSWORD_MAX_LENGTH)
  password: string;
}
