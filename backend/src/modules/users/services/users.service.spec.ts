import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { compare } from 'bcrypt';
import { SortOrder } from '../../../common/enums/sort-order.enum.js';
import { UsersRepository } from '../repositories/users.repository.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;

  const usersRepository = {
    findByEmail: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    findPage: vi.fn(),
    findExistingEmails: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    usersRepository.create.mockImplementation((data: object) => ({ ...data }));
    usersRepository.save.mockImplementation(async (data: object) => ({
      id: 'user-1',
      ...data,
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    const dto = {
      email: 'nova@empresa.com',
      name: 'Nova Pessoa',
      password: 'Senha@123',
    };

    it('grava a senha como hash bcrypt, nunca em texto puro', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      const user = await service.create(dto);

      expect(user.password).not.toBe(dto.password);
      expect(user.password).toMatch(/^\$2[aby]\$10\$/);
      await expect(compare(dto.password, user.password)).resolves.toBe(true);
      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, name: dto.name }),
      );
    });

    it('devolve 409 quando o e-mail já está cadastrado, sem gravar', async () => {
      usersRepository.findByEmail.mockResolvedValue({ id: 'existente' });

      const promise = service.create(dto);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('Este e-mail já está cadastrado.');
      expect(usersRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail / findById', () => {
    it('consulta o repositório pelo e-mail', async () => {
      usersRepository.findByEmail.mockResolvedValue({ id: 'u1' });

      await expect(service.findByEmail('a@b.com')).resolves.toEqual({
        id: 'u1',
      });
      expect(usersRepository.findByEmail).toHaveBeenCalledWith('a@b.com');
    });

    it('consulta o repositório pelo id', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('u1')).resolves.toBeNull();
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'u1' },
      });
    });
  });

  describe('findRegisteredEmails', () => {
    it('devolve o conjunto de e-mails que pertencem a usuários cadastrados', async () => {
      usersRepository.findExistingEmails.mockResolvedValue(['a@b.com']);

      const result = await service.findRegisteredEmails(['a@b.com', 'x@y.com']);

      expect(result).toEqual(new Set(['a@b.com']));
      expect(usersRepository.findExistingEmails).toHaveBeenCalledWith([
        'a@b.com',
        'x@y.com',
      ]);
    });
  });

  describe('search', () => {
    it.each([
      { nome: 'sem filtro', query: {} },
      { nome: 'nome com 2 caracteres', query: { name: 'an' } },
      { nome: 'e-mail com 2 caracteres', query: { email: 'a@' } },
      { nome: 'dois termos curtos', query: { name: 'an', email: 'a@' } },
    ])('$nome devolve 400 sem consultar o banco', async ({ query }) => {
      const promise = service.search({ page: 1, limit: 15, ...query });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Informe ao menos 3 caracteres no e-mail ou no nome para buscar usuários.',
      );
      expect(usersRepository.findPage).not.toHaveBeenCalled();
    });

    it('um termo com 3 caracteres basta, mesmo que o outro seja curto', async () => {
      usersRepository.findPage.mockResolvedValue([[], 0]);

      await expect(
        service.search({ page: 1, limit: 15, name: 'an', email: 'ana' }),
      ).resolves.toMatchObject({ meta: { total: 0, totalPages: 0 } });
    });

    it('ordena por nome asc por padrão e devolve só id, nome e e-mail', async () => {
      usersRepository.findPage.mockResolvedValue([
        [
          {
            id: 'u1',
            name: 'Ana',
            email: 'ana@empresa.com',
            password: 'hash',
            active: true,
          },
        ],
        1,
      ]);

      const result = await service.search({ page: 1, limit: 15, name: 'ana' });

      expect(usersRepository.findPage).toHaveBeenCalledWith(
        { name: 'ana', email: undefined },
        { sortBy: 'name', order: SortOrder.Asc },
        expect.objectContaining({ page: 1, limit: 15 }),
      );
      expect(result.data).toEqual([
        { id: 'u1', name: 'Ana', email: 'ana@empresa.com' },
      ]);
      expect(result.data[0]).not.toHaveProperty('password');
      expect(result.meta).toEqual({
        page: 1,
        limit: 15,
        total: 1,
        totalPages: 1,
      });
    });

    it('respeita a ordenação pedida e calcula totalPages pelo total', async () => {
      usersRepository.findPage.mockResolvedValue([[], 45]);

      const result = await service.search({
        page: 2,
        limit: 20,
        email: 'empresa',
        sortBy: 'email',
        order: SortOrder.Desc,
      });

      expect(usersRepository.findPage).toHaveBeenCalledWith(
        { name: undefined, email: 'empresa' },
        { sortBy: 'email', order: SortOrder.Desc },
        expect.anything(),
      );
      expect(result.meta.totalPages).toBe(3);
    });
  });
});
