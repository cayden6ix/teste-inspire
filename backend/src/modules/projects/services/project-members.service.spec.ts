import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { UsersService } from '../../users/services/users.service.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectMembersService } from './project-members.service.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';

// As regras de papel (R05/R06) e a desatribuição de tarefas (R13) estão em
// project-members.rules.spec.ts.
describe('ProjectMembersService', () => {
  let service: ProjectMembersService;

  const membersRepository = {
    findPageByProject: vi.fn(),
    findByProjectAndUser: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  const usersService = { findById: vi.fn(), search: vi.fn() };
  const accessService = { requireRole: vi.fn(), managesAnyProject: vi.fn() };

  const usuario = {
    id: TARGET_ID,
    name: 'Bruno Lima',
    email: 'bruno@empresa.com',
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    membersRepository.create.mockImplementation((data: object) => ({
      ...data,
    }));
    membersRepository.save.mockImplementation(async (data: object) => ({
      id: 'member-1',
      ...data,
    }));

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectMembersService,
        { provide: ProjectMembersRepository, useValue: membersRepository },
        { provide: UsersService, useValue: usersService },
        { provide: ProjectAccessService, useValue: accessService },
      ],
    }).compile();

    service = moduleRef.get(ProjectMembersService);
  });

  describe('list', () => {
    it('exige que o ator seja membro e devolve o envelope paginado', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Viewer);
      membersRepository.findPageByProject.mockResolvedValue([
        [
          {
            id: 'm1',
            userId: TARGET_ID,
            role: ProjectRole.Member,
            user: usuario,
          },
          { id: 'm2', userId: 'u2', role: ProjectRole.Viewer, user: undefined },
        ],
        21,
      ]);

      const result = await service.list(PROJECT_ID, ACTOR_ID, {
        page: 2,
        limit: 10,
        role: ProjectRole.Member,
      });

      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        ACTOR_ID,
        expect.arrayContaining([
          ProjectRole.Owner,
          ProjectRole.Admin,
          ProjectRole.Member,
          ProjectRole.Viewer,
        ]),
      );
      expect(membersRepository.findPageByProject).toHaveBeenCalledWith(
        PROJECT_ID,
        ProjectRole.Member,
        expect.objectContaining({ page: 2, limit: 10 }),
      );
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
      expect(result.data).toEqual([
        {
          id: 'm1',
          userId: TARGET_ID,
          name: 'Bruno Lima',
          email: 'bruno@empresa.com',
          role: 'member',
        },
        { id: 'm2', userId: 'u2', name: '', email: '', role: 'viewer' },
      ]);
    });

    it('propaga o erro de acesso (404 para quem não é membro) sem consultar membros', async () => {
      accessService.requireRole.mockRejectedValue(
        new NotFoundException('Projeto não encontrado.'),
      );

      await expect(
        service.list(PROJECT_ID, ACTOR_ID, { page: 1, limit: 15 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(membersRepository.findPageByProject).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers (GET /users, D-028)', () => {
    const query = { page: 1, limit: 10, email: 'bru' };

    it('owner ou admin de algum projeto busca: delega ao UsersService', async () => {
      accessService.managesAnyProject.mockResolvedValue(true);
      usersService.search.mockResolvedValue({ data: [usuario], meta: {} });

      await expect(service.searchUsers(ACTOR_ID, query)).resolves.toEqual({
        data: [usuario],
        meta: {},
      });
      expect(accessService.managesAnyProject).toHaveBeenCalledWith(ACTOR_ID);
      expect(usersService.search).toHaveBeenCalledWith(query);
    });

    it('quem não gerencia nenhum projeto recebe 403 e a busca nem roda', async () => {
      accessService.managesAnyProject.mockResolvedValue(false);

      const promise = service.searchUsers(ACTOR_ID, query);

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'Você não tem permissão para buscar usuários.',
      );
      expect(usersService.search).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    const dto = { userId: TARGET_ID, role: ProjectRole.Member };

    it('permite apenas owner e admin adicionar', async () => {
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(
        service.add(PROJECT_ID, ACTOR_ID, dto),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        ACTOR_ID,
        [ProjectRole.Owner, ProjectRole.Admin],
      );
    });

    it('devolve 404 quando o usuário não existe', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.add(PROJECT_ID, ACTOR_ID, dto),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devolve 409 quando o usuário já é membro', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
      usersService.findById.mockResolvedValue(usuario);
      membersRepository.findByProjectAndUser.mockResolvedValue({ id: 'm1' });

      const promise = service.add(PROJECT_ID, ACTOR_ID, dto);

      await expect(promise).rejects.toBeInstanceOf(ConflictException);
      await expect(promise).rejects.toThrow('Usuário já é membro do projeto.');
      expect(membersRepository.save).not.toHaveBeenCalled();
    });

    it('o owner adiciona com qualquer papel e recebe os dados do usuário', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
      usersService.findById.mockResolvedValue(usuario);
      membersRepository.findByProjectAndUser.mockResolvedValue(null);

      const result = await service.add(PROJECT_ID, ACTOR_ID, {
        userId: TARGET_ID,
        role: ProjectRole.Admin,
      });

      expect(membersRepository.create).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        userId: TARGET_ID,
        role: ProjectRole.Admin,
      });
      expect(result).toEqual({
        id: 'member-1',
        userId: TARGET_ID,
        name: 'Bruno Lima',
        email: 'bruno@empresa.com',
        role: 'admin',
      });
    });

    it('o admin adiciona viewer', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Admin);
      usersService.findById.mockResolvedValue(usuario);
      membersRepository.findByProjectAndUser.mockResolvedValue(null);

      const result = await service.add(PROJECT_ID, ACTOR_ID, {
        userId: TARGET_ID,
        role: ProjectRole.Viewer,
      });

      expect(result.role).toBe(ProjectRole.Viewer);
    });
  });

  describe('updateRole', () => {
    it('devolve 404 quando o membro não existe', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
      membersRepository.findByProjectAndUser.mockResolvedValue(null);

      await expect(
        service.updateRole(PROJECT_ID, ACTOR_ID, TARGET_ID, {
          role: ProjectRole.Viewer,
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('o owner altera o papel de um membro e recebe nome e e-mail atualizados', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
      membersRepository.findByProjectAndUser.mockResolvedValue({
        id: 'm1',
        userId: TARGET_ID,
        role: ProjectRole.Viewer,
      });
      usersService.findById.mockResolvedValue(usuario);

      const result = await service.updateRole(PROJECT_ID, ACTOR_ID, TARGET_ID, {
        role: ProjectRole.Admin,
      });

      expect(membersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'm1', role: ProjectRole.Admin }),
      );
      expect(result).toEqual({
        id: 'm1',
        userId: TARGET_ID,
        name: 'Bruno Lima',
        email: 'bruno@empresa.com',
        role: 'admin',
      });
    });
  });

  describe('remove', () => {
    it('devolve 404 quando o membro não existe', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
      membersRepository.findByProjectAndUser.mockResolvedValue(null);

      await expect(
        service.remove(PROJECT_ID, ACTOR_ID, TARGET_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
