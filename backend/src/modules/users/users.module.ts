import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UsersController } from './controllers/users.controller.js';
import { User } from './entities/user.entity.js';
import { UsersRepository } from './repositories/users.repository.js';
import { UsersService } from './services/users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  // O guard e registrado localmente para nao criar ciclo com o AuthModule
  // (o AuthModule ja depende deste modulo).
  providers: [UsersRepository, UsersService, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
