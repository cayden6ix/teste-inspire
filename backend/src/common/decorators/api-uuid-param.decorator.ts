import { ApiParam } from '@nestjs/swagger';

/**
 * Documenta um parametro de rota que e UUID (`projectId`, `taskId`, `userId`).
 */
export function ApiUuidParam(name: string) {
  return ApiParam({
    name,
    description: `Identificador (UUID) de ${name}`,
    schema: { type: 'string', format: 'uuid' },
  });
}
