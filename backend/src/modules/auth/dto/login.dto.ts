import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Trim } from '../../../common/decorators/trim.decorator.js';

export class LoginDto {
  @ApiProperty({ format: 'email', example: 'ana.souza@empresa.com', description: 'Email cadastrado' })
  @Trim({ lowercase: true })
  @IsEmail()
  email: string;

  @ApiProperty({ format: 'password', example: 'Senha@123', description: 'Senha da conta' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
