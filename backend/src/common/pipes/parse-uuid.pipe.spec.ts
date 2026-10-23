import { BadRequestException } from '@nestjs/common';
import { INVALID_UUID_MESSAGE } from '../messages/http-messages.js';
import { PARSE_UUID_PIPE } from './parse-uuid.pipe.js';

const metadata = { type: 'param', data: 'projectId' } as const;

describe('PARSE_UUID_PIPE', () => {
  it('aceita um UUID válido e o devolve sem alterar', async () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

    await expect(PARSE_UUID_PIPE.transform(uuid, metadata)).resolves.toBe(uuid);
  });

  it.each([
    'abc',
    '123',
    '',
    '3f2504e0-4f89-41d3-9a0c-0305e82c33',
    'não-é-uuid',
    "1' OR '1'='1",
  ])('rejeita "%s" com 400 e a mensagem em português', async (valor) => {
    const promise = PARSE_UUID_PIPE.transform(valor, metadata);

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(INVALID_UUID_MESSAGE);
  });
});
