import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { buildTypeOrmOptions } from './config/database/typeorm.config.js';
import { validateEnv } from './config/env/env.validation.js';
import { AppThrottlerGuard } from './config/throttle/app-throttler.guard.js';
import { buildThrottlerOptions } from './config/throttle/throttler.config.js';
import { HealthModule } from './modules/health/health.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env'],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => buildTypeOrmOptions(configService),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => buildThrottlerOptions(configService),
    }),
    HealthModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    TasksModule,
    ReportsModule,
  ],
  providers: [
    // Guards globais, nesta ordem: o rate limit roda antes da autenticacao.
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    // Toda rota exige token, exceto as marcadas com @Public() (auth e health).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
