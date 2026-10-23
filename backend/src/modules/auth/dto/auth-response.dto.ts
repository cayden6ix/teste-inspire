import { ApiProperty } from '@nestjs/swagger';

/**
 * Dados publicos do usuario autenticado (sem `password`).
 */
export class AuthUserResponseDto {
  @ApiProperty({ format: 'uuid', example: '5b7e1c2a-9d3f-4e8b-a1c6-7f2d9e0b3a14' })
  id: string;

  @ApiProperty({ example: 'Ana Souza' })
  name: string;

  @ApiProperty({ format: 'email', example: 'ana.souza@empresa.com' })
  email: string;

  @ApiProperty({ example: true, description: 'Usuario ativo; inativos nao conseguem fazer login' })
  active: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

/**
 * Resposta de `POST /auth/register` e `POST /auth/login`.
 */
export class AuthResponseDto {
  @ApiProperty({
    description: 'Token JWT. Envie em `Authorization: Bearer <access_token>`',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1YjdlMWMyYSJ9.assinatura',
  })
  access_token: string;

  @ApiProperty({ type: () => AuthUserResponseDto })
  user: AuthUserResponseDto;
}
