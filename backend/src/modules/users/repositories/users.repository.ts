import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsOrder, FindOptionsWhere, ILike, Repository } from 'typeorm';
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
   * Pagina os usuarios com busca parcial por nome e/ou email.
   */
  findPage(
    filters: UserPageFilters,
    sort: UserPageSort,
    pagination: PaginationParams,
  ): Promise<[User[], number]> {
    const where: FindOptionsWhere<User> = {};

    if (filters.name) {
      where.name = ILike(`%${escapeLike(filters.name)}%`);
    }

    if (filters.email) {
      where.email = ILike(`%${escapeLike(filters.email)}%`);
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
