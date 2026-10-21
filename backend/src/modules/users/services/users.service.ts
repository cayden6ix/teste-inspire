import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { User } from '../entities/user.entity.js';
import { UsersRepository } from '../repositories/users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.usersRepository.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException('Email ja cadastrado');
    }

    const user = this.usersRepository.create({
      email: dto.email,
      name: dto.name,
      password: await hash(dto.password, 10),
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }
}
