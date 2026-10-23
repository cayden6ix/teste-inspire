import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SortablePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import {
  USER_EMAIL_MAX_LENGTH,
  USER_NAME_MAX_LENGTH,
  USER_SEARCH_MAX_LIMIT,
  USER_SORT_FIELDS,
  type UserSortField,
} from '../users.types.js';

export class ListUsersQueryDto extends SortablePaginationQueryDto {
  /**
   * Teto proprio, menor que o das demais listagens: a busca serve para achar quem
   * adicionar a um projeto, nao para percorrer o diretorio de usuarios.
   * Os validadores sao redeclarados porque substituem os herdados da paginacao.
   */
  @ApiPropertyOptional({
    minimum: 1,
    maximum: USER_SEARCH_MAX_LIMIT,
    default: USER_SEARCH_MAX_LIMIT,
    description: 'Quantidade de itens por pagina (maximo 10 nesta busca)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USER_SEARCH_MAX_LIMIT)
  override limit: number = USER_SEARCH_MAX_LIMIT;

  @ApiPropertyOptional({
    example: 'ana@exemplo.com',
    description:
      'Filtra os usuarios por email (busca parcial, sem diferenciar maiusculas nem acentos). ' +
      'Informe email ou name com no minimo 3 caracteres.',
  })
  @IsOptional()
  @Trim({ emptyToUndefined: true })
  @IsString()
  @MaxLength(USER_EMAIL_MAX_LENGTH)
  email?: string;

  @ApiPropertyOptional({
    example: 'Ana',
    description:
      'Filtra os usuarios por nome (busca parcial, sem diferenciar maiusculas nem acentos). ' +
      'Informe email ou name com no minimo 3 caracteres.',
  })
  @IsOptional()
  @Trim({ emptyToUndefined: true })
  @IsString()
  @MaxLength(USER_NAME_MAX_LENGTH)
  name?: string;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;
}
