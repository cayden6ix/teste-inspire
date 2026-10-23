import { ApiProperty } from '@nestjs/swagger';

/**
 * Usuario devolvido na busca de usuarios (apenas dados publicos).
 */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid', example: '5b7e1c2a-9d3f-4e8b-a1c6-7f2d9e0b3a14' })
  id: string;

  @ApiProperty({ example: 'Bruno Lima' })
  name: string;

  @ApiProperty({ format: 'email', example: 'bruno.lima@empresa.com' })
  email: string;
}
