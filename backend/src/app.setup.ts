import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { buildValidationException } from './common/validation/validation-exception.factory.js';
import { parseTrustProxy } from './config/env/env.validation.js';

/**
 * Configuracao HTTP da aplicacao: seguranca, parsers, CORS, prefixo, validacao,
 * filtro de erros e Swagger.
 *
 * Fica fora do `main.ts` para que os testes e2e montem o app exatamente igual ao
 * servidor real, sem replicar esta configuracao.
 */
export function configureApp(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);

  app.use(helmet());

  // Atras de proxy reverso (nginx), o IP real do cliente vem do X-Forwarded-For.
  // Usado pelo rate limit; desligado por padrao para nao confiar em cabecalho forjado.
  app.set('trust proxy', parseTrustProxy(configService.getOrThrow<string>('TRUST_PROXY')));

  // Importacao de CSV (D-014): o corpo pode chegar como texto puro (text/csv).
  app.useBodyParser('text', {
    type: ['text/csv', 'text/plain'],
    limit: '5mb',
  });

  app.enableCors({
    origin: configService
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((origin) => origin.trim()),
    // A autenticacao usa Bearer token no cabecalho, sem cookies: nada de credentials.
    credentials: false,
  });

  app.setGlobalPrefix(configService.getOrThrow<string>('API_PREFIX'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: buildValidationException,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  if (configService.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    setupSwagger(app);
  }
}

/**
 * Documentacao OpenAPI em /docs (JSON em /docs-json), controlada por SWAGGER_ENABLED.
 */
function setupSwagger(app: NestExpressApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('API de Gestao de Projetos e Tarefas')
    .setDescription(
      'API REST para organizacao do trabalho de diferentes usuarios: ' +
        'cadastro e autenticacao, gestao de projetos e tarefas e relatorios.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
