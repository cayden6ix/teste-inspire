import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { warnIfWeakJwtSecret } from './config/env/jwt-secret.check.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);

  configureApp(app);
  warnIfWeakJwtSecret(configService.getOrThrow<string>('JWT_SECRET'), Logger);
  app.enableShutdownHooks();

  const port = configService.getOrThrow<number>('PORT');
  await app.listen(port);

  const apiPrefix = configService.getOrThrow<string>('API_PREFIX');
  Logger.log(`API disponivel em http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  if (configService.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    Logger.log(`Documentacao Swagger em http://localhost:${port}/docs`, 'Bootstrap');
  }
}

await bootstrap();
