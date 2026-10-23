import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  // O transformador padrao do Vite nao emite `emitDecoratorMetadata`, e sem os
  // metadados de `design:paramtypes` a injecao de dependencias do Nest nao resolve.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    // Testes unitarios: specs ao lado do codigo (convencao do Nest) e em test/.
    // Nao dependem de banco; repositorios e servicos externos sao mocks.
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      // Fora da cobertura: codigo sem logica propria ou exercitado so pelo e2e/banco.
      // - main.ts, *.module.ts: bootstrap e composicao de DI;
      // - database/** (migrations e seed) e data-source.ts: DDL e CLI, validados pelo e2e;
      // - *.entity.ts: declaracoes de mapeamento TypeORM;
      // - *-response.dto.ts e error-response.dto.ts: classes apenas para o Swagger;
      // - shared/types: so interfaces.
      exclude: [
        'src/**/*.spec.ts',
        'src/main.ts',
        'src/**/*.module.ts',
        'src/database/**',
        'src/config/database/data-source.ts',
        'src/**/*.entity.ts',
        'src/**/*-response.dto.ts',
        'src/shared/types/**',
      ],
    },
  },
});
