import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Mesmo motivo do vitest.config.ts: a DI do Nest precisa dos metadados de decorators.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    // Cria o schema do banco app_test (migrations a partir de src) uma vez por execucao.
    globalSetup: ['./test/setup/global-setup.ts'],
    // Variaveis de ambiente de teste e guarda do banco, antes de qualquer import do AppModule.
    setupFiles: ['./test/setup/e2e-setup.ts'],
    // Todos os arquivos compartilham o mesmo banco: executam em sequencia.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // `npm run test:e2e:cov`: cobertura dos controllers e repositories, que so o e2e exercita.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage/e2e',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/database/**',
        'src/config/database/data-source.ts',
        'src/**/*-response.dto.ts',
        'src/shared/types/**',
      ],
    },
  },
});
