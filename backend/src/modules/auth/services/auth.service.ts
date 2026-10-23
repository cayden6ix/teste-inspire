import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { UsersService } from '../../users/services/users.service.js';
import { User } from '../../users/entities/user.entity.js';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';
import { toPublicUser } from '../../users/mappers/public-user.mapper.js';
import { AuthResponseDto } from '../dto/auth-response.dto.js';

/**
 * Hash bcrypt (custo 10, o mesmo do cadastro) de uma senha que nao pertence a ninguem.
 * Quando o e-mail nao existe, a senha e comparada com ele: o login leva o mesmo tempo
 * com e sem conta, e a resposta nao revela quais e-mails estao cadastrados.
 */
const DUMMY_PASSWORD_HASH = '$2b$10$jjZqXiM/mSpBESAhLUoC1eVs7CjDFJZWuKmJn3bcgr.riCSHlB3ai';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto): Promise<AuthResponseDto> {
    const user = await this.usersService.create(dto);
    return this.generateToken(user);
  }

  async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(email);
    const valid = await compare(password, user?.password ?? DUMMY_PASSWORD_HASH);

    if (!user || !user.active || !valid) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.generateToken(user);
  }

  private generateToken(user: User): AuthResponseDto {
    const payload = { sub: user.id, email: user.email };
    return {
      access_token: this.jwtService.sign(payload),
      user: toPublicUser(user),
    };
  }
}
