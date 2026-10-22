import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { ILike } from 'typeorm';
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

  /**
   * Busca usuarios por email (trecho), devolvendo apenas dados publicos.
   *
   * Usado pela tela de membros do projeto para adicionar alguem por email.
   */
  async search(email?: string): Promise<Array<Pick<User, 'id' | 'name' | 'email'>>> {
    const users = await this.usersRepository.find({
      where: email ? { email: ILike(`%${email}%`) } : {},
      order: { name: 'ASC' },
      take: 50,
    });

    return users.map(({ id, name, email: userEmail }) => ({ id, name, email: userEmail }));
  }
}
