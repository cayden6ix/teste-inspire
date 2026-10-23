import { Logger } from '@nestjs/common';
import { resolveTestDatabaseUrl } from './test-database.js';

/**
 * Executa antes de cada arquivo e2e, antes de qualquer import do AppModule: o
 * ConfigModule le o ambiente no momento do import, e `process.env` tem prioridade
 * sobre o `.env` local (que aponta para o app_db).
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = resolveTestDatabaseUrl();
process.env.DATABASE_SYNCHRONIZE = 'false';
process.env.DATABASE_LOGGING = 'false';
process.env.JWT_SECRET = 'segredo-de-teste-com-no-minimo-32-caracteres';
process.env.JWT_EXPIRES_IN = '1h';
process.env.API_PREFIX = 'api';
process.env.CORS_ORIGINS = 'http://localhost:5173';
// O Swagger so liga no teste dedicado de /docs (docs.e2e-spec.ts); nos demais so atrasaria o boot.
process.env.SWAGGER_ENABLED = 'false';
// Sem atras de proxy: o IP do rate limit e o do socket.
process.env.TRUST_PROXY = 'false';
// Sem rate limit nos e2e, exceto no teste dedicado do 429 (que liga o throttler no proprio app).
process.env.THROTTLE_DISABLED = 'true';

// Silencia os logs do Nest (cada 4xx/5xx esperado nos testes gera uma linha). Para depurar: E2E_LOGS=true.
if (process.env.E2E_LOGS !== 'true') {
  Logger.overrideLogger(false);
}
