import { ApiProperty } from '@nestjs/swagger';

/**
 * Formato padrao de erro da API, produzido pelo `AllExceptionsFilter`.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400, description: 'Codigo HTTP do erro' })
  statusCode: number;

  @ApiProperty({ example: 'BAD_REQUEST', description: 'Nome do status HTTP' })
  error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['O campo "Limite" deve ser menor ou igual a 100.'],
    description: 'Mensagem unica ou, na validacao, lista de mensagens em portugues',
  })
  message: string | string[];

  @ApiProperty({ example: '/api/projects?limit=101', description: 'Caminho da requisicao' })
  path: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-22T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({
    example: '3f2b8c1e-6d4a-4f0e-9b7a-2c1d5e8f9a10',
    description: 'Id de correlacao: reaproveita o header x-request-id ou gera um UUID',
  })
  requestId: string;
}
