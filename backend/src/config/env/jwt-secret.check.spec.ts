import {
  isWeakJwtSecret,
  warnIfWeakJwtSecret,
  WEAK_JWT_SECRET_WARNING,
} from './jwt-secret.check.js';

/** Valor publico do `.env.example` da raiz. */
const SEGREDO_DE_EXEMPLO = 'troque-este-valor-por-um-segredo-forte-de-no-minimo-32-chars';

/** Formato de `openssl rand -hex 32`. */
const SEGREDO_FORTE = '9f3c1a7be04d52e8a6c9b1f07d3e2a4c58b9e6f1a2d3c4b5e6f708192a3b4c5d';

describe('isWeakJwtSecret', () => {
  it('reconhece o valor de exemplo do .env.example', () => {
    expect(isWeakJwtSecret(SEGREDO_DE_EXEMPLO)).toBe(true);
  });

  it.each([
    'TROQUE-ESTE-VALOR-em-maiusculas-com-32-caracteres',
    'meu-jwt-secret-de-desenvolvimento-local-123',
    'changeme-changeme-changeme-changeme-1234',
    'segredo-de-teste-com-no-minimo-32-caracteres',
  ])('reconhece marcadores de segredo de exemplo: %s', (segredo) => {
    expect(isWeakJwtSecret(segredo)).toBe(true);
  });

  it('reconhece segredo repetitivo (poucos caracteres distintos)', () => {
    expect(isWeakJwtSecret('a'.repeat(64))).toBe(true);
    expect(isWeakJwtSecret('abababababababababababababababab')).toBe(true);
  });

  it('aceita um segredo aleatório (openssl rand -hex 32)', () => {
    expect(isWeakJwtSecret(SEGREDO_FORTE)).toBe(false);
  });
});

describe('warnIfWeakJwtSecret', () => {
  it('registra o aviso (sem interromper o boot) quando o segredo é o de exemplo', () => {
    const logger = { warn: vi.fn() };

    expect(warnIfWeakJwtSecret(SEGREDO_DE_EXEMPLO, logger)).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(WEAK_JWT_SECRET_WARNING, 'Seguranca');
    expect(WEAK_JWT_SECRET_WARNING).toContain('openssl rand -hex 32');
  });

  it('não avisa quando o segredo é forte', () => {
    const logger = { warn: vi.fn() };

    expect(warnIfWeakJwtSecret(SEGREDO_FORTE, logger)).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
