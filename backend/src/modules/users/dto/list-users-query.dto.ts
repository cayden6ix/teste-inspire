import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SortablePaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { Trim } from '../../../common/decorators/trim.decorator.js';
import { USER_SORT_FIELDS, type UserSortField } from '../users.types.js';

export class ListUsersQueryDto extends SortablePaginationQueryDto {
  @ApiPropertyOptional({
    example: 'ana@exemplo.com',
    description:
      'Filtra os usuarios por email (busca parcial, sem diferenciar maiusculas). ' +
      'Informe email ou name com no minimo 3 caracteres.',
  })
  @IsOptional()
  @Trim({ emptyToUndefined: true })
  @IsString()
  @MaxLength(320)
  email?: string;

  @ApiPropertyOptional({
    example: 'Ana',
    description:
      'Filtra os usuarios por nome (busca parcial, sem diferenciar maiusculas). ' +
      'Informe email ou name com no minimo 3 caracteres.',
  })
  @IsOptional()
  @Trim({ emptyToUndefined: true })
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: USER_SORT_FIELDS, default: 'name' })
  @IsOptional()
  @IsIn(USER_SORT_FIELDS)
  sortBy?: UserSortField;
}
