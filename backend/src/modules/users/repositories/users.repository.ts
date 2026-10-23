import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsOrder, FindOptionsWhere, Raw, Repository } from 'typeorm';
import { PaginationParams } from '../../../common/dto/paginated.dto.js';
import { escapeLike } from '../../../common/utils/like.util.js';
import { toSqlDirection } from '../../../common/utils/pagination.util.js';
import { User } from '../entities/user.entity.js';
import type { UserPageFilters, UserPageSort } from '../users.types.js';

@Injectable()
export class UsersRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne({ where: { email } });
  }

  /**
   * Quais dos e-mails informados (em minusculas) pertencem a usuarios cadastrados.
   */
  async findExistingEmails(emails: string[]): Promise<string[]> {
    if (emails.length === 0) {
      return [];
    }

    const rows = await this.createQueryBuilder('user')
      .select('LOWER(user.email)', 'email')
      .where('LOWER(user.email) IN (:...emails)', { emails })
      .getRawMany<{ email: string }>();

    return rows.map((row) => row.email);
  }

  /**
   * Pagina os usuarios com busca parcial por nome e/ou email, sem diferenciar maiusculas
   * nem acentos (unaccent, D-029); curingas digitados sao tratados como texto.
   */
  findPage(
    filters: UserPageFilters,
    sort: UserPageSort,
    pagination: PaginationParams,
  ): Promise<[User[], number]> {
    const where: FindOptionsWhere<User> = {};

    if (filters.name) {
      where.name = unaccentILike('name', filters.name);
    }

    if (filters.email) {
      where.email = unaccentILike('email', filters.email);
    }

    // Desempate por id na mesma direcao, para a paginacao ser deterministica.
    const order: FindOptionsOrder<User> = {
      [sort.sortBy]: toSqlDirection(sort.order),
      id: toSqlDirection(sort.order),
    };

    return this.findAndCount({
      where,
      select: { id: true, name: true, email: true },
      order,
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });
  }
}

/** `unaccent(coluna) ILIKE unaccent('%termo%')`, com os curingas do termo escapados. */
function unaccentILike(parameter: string, term: string) {
  return Raw((alias) => `unaccent(${alias}) ILIKE unaccent(:${parameter})`, {
    [parameter]: `%${escapeLike(term)}%`,
  });
}
