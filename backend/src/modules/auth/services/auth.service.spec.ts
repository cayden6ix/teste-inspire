import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { compare, hash } from 'bcrypt';
import { UsersService } from '../../users/services/users.service.js';
import { AuthService } from './auth.service.js';

// compare real, mas observavel: prova que o login compara a senha mesmo sem usuario.
vi.mock('bcrypt', async (importOriginal) => {
  const original = await importOriginal<typeof import('bcrypt')>();
  return { ...original, compare: vi.fn(original.compare) };
});

describe('AuthService', () => {
  let service: AuthService;
  let senhaHash: string;

  const usersService = { create: vi.fn(), findByEmail: vi.fn() };
  const jwtService = { sign: vi.fn() };

  beforeAll(async () => {
    senhaHash = await hash('Senha@123', 4);
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    jwtService.sign.mockReturnValue('token-assinado');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  const usuario = () => ({
    id: 'user-1',
    email: 'ana@empresa.com',
    name: 'Ana',
    password: senhaHash,
    active: true,
  });

  describe('login', () => {
    it('com credenciais válidas emite o token e devolve o usuário sem a senha', async () => {
      usersService.findByEmail.mockResolvedValue(usuario());

      const result = await service.login('ana@empresa.com', 'Senha@123');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'ana@empresa.com',
      });
      expect(result.access_token).toBe('token-assinado');
      expect(result.user).toMatchObject({
        id: 'user-1',
        email: 'ana@empresa.com',
        name: 'Ana',
      });
      expect(result.user).not.toHaveProperty('password');
    });

    it('senha errada devolve 401 "Credenciais inválidas."', async () => {
      usersService.findByEmail.mockResolvedValue(usuario());

      const promise = service.login('ana@empresa.com', 'senha-errada');

      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(promise).rejects.toThrow('Credenciais inválidas.');
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('usuário inexistente devolve a mesma mensagem da senha errada', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const promise = service.login('ninguem@empresa.com', 'Senha@123');

      await expect(promise).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(promise).rejects.toThrow('Credenciais inválidas.');
    });

    it('com e-mail inexistente compara a senha com um hash fictício (mesmo custo, sem revelar quais e-mails existem)', async () => {
      vi.mocked(compare).mockClear();
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login('ninguem@empresa.com', 'Senha@123'),
      ).rejects.toThrow('Credenciais inválidas.');

      expect(compare).toHaveBeenCalledTimes(1);
      const [senha, hashFicticio] = vi.mocked(compare).mock
        .calls[0] as unknown as [string, string];
      expect(senha).toBe('Senha@123');
      expect(hashFicticio).toMatch(/^\$2[aby]\$10\$/);
    });

    it('usuário inativo não consegue entrar, mesmo com a senha certa', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...usuario(),
        active: false,
      });

      await expect(
        service.login('ana@empresa.com', 'Senha@123'),
      ).rejects.toThrow('Credenciais inválidas.');
    });
  });

  describe('register', () => {
    it('cria o usuário e já devolve o token, sem expor a senha', async () => {
      usersService.create.mockResolvedValue(usuario());
      const dto = {
        email: 'ana@empresa.com',
        name: 'Ana',
        password: 'Senha@123',
      };

      const result = await service.register(dto);

      expect(usersService.create).toHaveBeenCalledWith(dto);
      expect(result.access_token).toBe('token-assinado');
      expect(result.user).not.toHaveProperty('password');
    });
  });
});
