import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Estado da API' })
  status: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-22T12:00:00.000Z' })
  timestamp: string;
}
