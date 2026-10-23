import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { assertTestDatabaseName } from '../setup/test-database.js';

export const API_PREFIX = 'api';

export interface TestApp {
  app: NestExpressApplication;
  dataSource: DataSource;
  /** Cliente supertest ligado ao servidor HTTP do app (sem abrir porta fixa). */
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

/**
 * Sobe o AppModule real (Postgres do banco de testes) com a MESMA configuracao do servidor:
 * `configureApp`, de src/app.setup.ts, e a mesma usada pelo main.ts.
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);

  // Guarda final: o app so pode estar conectado a um banco de testes.
  const [{ name }] = (await dataSource.query(
    'SELECT current_database() AS name',
  )) as Array<{
    name: string;
  }>;
  try {
    assertTestDatabaseName(name);
  } catch (error) {
    await app.close();
    throw error;
  }

  return {
    app,
    dataSource,
    http: () => request(app.getHttpServer()),
    close: () => app.close(),
  };
}
