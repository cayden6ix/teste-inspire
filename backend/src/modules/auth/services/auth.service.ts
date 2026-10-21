import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { UsersService } from '../../users/services/users.service.js';
import { User } from '../../users/entities/user.entity.js';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

export interface AuthResponse {
  access_token: string;
  user: Omit<User, 'password'>;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: CreateUserDto): Promise<AuthResponse> {
    const user = await this.usersService.create(dto);
    return this.generateToken(user);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.active) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const valid = await compare(password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    return this.generateToken(user);
  }

  private generateToken(user: User): AuthResponse {
    const payload = { sub: user.id, email: user.email };
    const { password, ...userWithoutPassword } = user;
    return {
      access_token: this.jwtService.sign(payload),
      user: userWithoutPassword,
    };
  }
}
