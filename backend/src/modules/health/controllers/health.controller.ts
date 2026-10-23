import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator.js';
import { HealthResponseDto } from '../dto/health-response.dto.js';

@ApiTags('health')
@Public()
// Healthcheck do container e de orquestradores nao consome o limite por IP.
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiOperation({ summary: 'Verifica se a API esta no ar' })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
