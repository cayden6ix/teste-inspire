import type { LoggerService } from '@nestjs/common';

/**
 * Trechos que denunciam um segredo de exemplo ou de teste (comparados em minusculas):
 * o primeiro e o do `.env.example`, que e publico.
 */
const PLACEHOLDER_MARKERS = ['troque-este-valor', 'change-me', 'changeme', 'secret', 'segredo'];

/** Abaixo disso de caracteres distintos o segredo e repetitivo demais (ex.: `aaaa...`). */
const MIN_DISTINCT_CHARS = 10;

export const WEAK_JWT_SECRET_WARNING =
  'JWT_SECRET parece ser o valor de exemplo do .env.example ou um segredo fraco. ' +
  'Qualquer pessoa que conheça esse valor consegue emitir tokens válidos para esta API. ' +
  'Gere um segredo próprio (por exemplo, `openssl rand -hex 32`), coloque-o no .env e reinicie a API.';

/**
 * O JWT_SECRET e o de exemplo ou parece fraco? O tamanho minimo (32) ja e exigido pela
 * validacao do ambiente; aqui so se detecta o segredo publico ou previsivel.
 */
export function isWeakJwtSecret(secret: string): boolean {
  const normalized = secret.toLowerCase();

  return (
    PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker)) ||
    new Set(secret).size < MIN_DISTINCT_CHARS
  );
}

/**
 * Registra um aviso no boot quando o JWT_SECRET e fraco (D-031). Nao impede a subida:
 * o `cp .env.example .env && docker compose up -d --build` precisa continuar funcionando
 * para avaliacao local.
 */
export function warnIfWeakJwtSecret(secret: string, logger: Pick<LoggerService, 'warn'>): boolean {
  if (!isWeakJwtSecret(secret)) {
    return false;
  }

  logger.warn(WEAK_JWT_SECRET_WARNING, 'Seguranca');
  return true;
}
