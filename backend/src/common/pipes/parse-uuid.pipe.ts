import { BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { INVALID_UUID_MESSAGE } from '../messages/http-messages.js';

/**
 * Valida parametros de rota que sao UUID, com a mensagem em portugues.
 */
export const PARSE_UUID_PIPE = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException(INVALID_UUID_MESSAGE),
});
