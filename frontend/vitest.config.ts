import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Testes unitarios do frontend: logica pura (regras de papel, mensagens de erro, formatacao,
 * JWT, redirecionamento, stores), em ambiente node, sem navegador. Specs ao lado do codigo.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
