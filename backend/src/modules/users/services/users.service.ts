import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { PaginatedResponse } from '../../../common/dto/paginated.dto.js';
import { SortOrder } from '../../../common/enums/sort-order.enum.js';
import { toPaginatedResponse } from '../../../common/utils/pagination.util.js';
import { CreateUserDto } from '../dto/create-user.dto.js';
import { ListUsersQueryDto } from '../dto/list-users-query.dto.js';
import { UserResponseDto } from '../dto/user-response.dto.js';
import { User } from '../entities/user.entity.js';
import { UsersRepository } from '../repositories/users.repository.js';

/**
 * Tamanho minimo do termo de busca de usuarios (e-mail ou nome, apos o trim).
 * Impede que qualquer usuario autenticado liste o diretorio inteiro de e-mails.
 */
const USER_SEARCH_MIN_LENGTH = 3;

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    const exists = await this.usersRepository.findByEmail(dto.email);
    if (exists) {
      throw new ConflictException('Este e-mail já está cadastrado.');
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
   * Dos e-mails informados (em minusculas), os que pertencem a usuarios cadastrados.
   * Uma unica query, para a importacao CSV nao consultar e-mail por e-mail.
   */
  async findRegisteredEmails(emails: string[]): Promise<Set<string>> {
    return new Set(await this.usersRepository.findExistingEmails(emails));
  }

  /**
   * Busca paginada de usuarios por nome e/ou email (trecho), devolvendo apenas dados publicos.
   *
   * Usado pela tela de membros do projeto para adicionar alguem. Exige um termo com
   * pelo menos 3 caracteres no e-mail ou no nome. Ordenacao padrao: nome asc.
   */
  async search(query: ListUsersQueryDto): Promise<PaginatedResponse<UserResponseDto>> {
    const hasTerm = [query.email, query.name].some(
      (term) => (term?.length ?? 0) >= USER_SEARCH_MIN_LENGTH,
    );

    if (!hasTerm) {
      throw new BadRequestException(
        `Informe ao menos ${USER_SEARCH_MIN_LENGTH} caracteres no e-mail ou no nome para buscar usuários.`,
      );
    }

    const [users, total] = await this.usersRepository.findPage(
      { name: query.name, email: query.email },
      {
        sortBy: query.sortBy ?? 'name',
        order: query.order ?? SortOrder.Asc,
      },
      query,
    );

    return toPaginatedResponse(
      users.map(({ id, name, email }) => ({ id, name, email })),
      total,
      query,
    );
  }
}
