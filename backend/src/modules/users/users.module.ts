import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UsersRepository } from './repositories/users.repository.js';
import { UsersService } from './services/users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
