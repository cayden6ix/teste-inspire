import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { UsersService } from '../../users/services/users.service.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectMembersService } from './project-members.service.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const TARGET_ID = '33333333-3333-4333-8333-333333333333';

const { Owner, Admin, Member, Viewer } = ProjectRole;

/**
 * Matriz de papéis de D-013 (R05/R06):
 * - o papel owner nasce na criação do projeto: não é atribuído nem retirado;
 * - o owner gerencia todos os outros papéis; o admin só age sobre member/viewer e só atribui
 *   member/viewer;
 * - ninguém altera o próprio papel nem se remove.
 */
describe('ProjectMembersService: regras de papéis', () => {
  let service: ProjectMembersService;

  const membersRepository = {
    findByProjectAndUser: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    removeAndUnassignTasks: vi.fn(),
  };
  const usersService = { findById: vi.fn() };
  const accessService = { requireRole: vi.fn() };

  const alvo = (role: ProjectRole, userId = TARGET_ID) => ({
    id: 'member-1',
    userId,
    projectId: PROJECT_ID,
    role,
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    membersRepository.create.mockImplementation((data: object) => ({
      ...data,
    }));
    membersRepository.save.mockImplementation(async (data: object) => ({
      id: 'member-1',
      ...data,
    }));
    usersService.findById.mockResolvedValue({
      id: TARGET_ID,
      name: 'Bruno',
      email: 'bruno@empresa.com',
    });

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

  describe('add', () => {
    beforeEach(() => {
      membersRepository.findByProjectAndUser.mockResolvedValue(null);
    });

    it.each([
      { ator: Owner, papel: Admin },
      { ator: Owner, papel: Member },
      { ator: Owner, papel: Viewer },
      { ator: Admin, papel: Member },
      { ator: Admin, papel: Viewer },
    ])('$ator adiciona com o papel $papel', async ({ ator, papel }) => {
      accessService.requireRole.mockResolvedValue(ator);

      const result = await service.add(PROJECT_ID, ACTOR_ID, {
        userId: TARGET_ID,
        role: papel,
      });

      expect(result.role).toBe(papel);
      expect(membersRepository.save).toHaveBeenCalled();
    });

    it.each([Owner, Admin])(
      '%s não consegue atribuir owner (400)',
      async (ator) => {
        accessService.requireRole.mockResolvedValue(ator);

        const promise = service.add(PROJECT_ID, ACTOR_ID, {
          userId: TARGET_ID,
          role: Owner,
        });

        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(promise).rejects.toThrow(
          'O papel de proprietário é definido apenas na criação do projeto e não pode ser atribuído.',
        );
        expect(membersRepository.save).not.toHaveBeenCalled();
      },
    );

    it('admin não adiciona outro admin (403)', async () => {
      accessService.requireRole.mockResolvedValue(Admin);

      const promise = service.add(PROJECT_ID, ACTOR_ID, {
        userId: TARGET_ID,
        role: Admin,
      });

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'Administradores só podem atribuir os papéis membro ou visualizador.',
      );
      expect(membersRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it.each([
      { ator: Owner, atual: Admin, novo: Member },
      { ator: Owner, atual: Admin, novo: Viewer },
      { ator: Owner, atual: Member, novo: Admin },
      { ator: Owner, atual: Member, novo: Viewer },
      { ator: Owner, atual: Viewer, novo: Admin },
      { ator: Owner, atual: Viewer, novo: Member },
      { ator: Admin, atual: Member, novo: Viewer },
      { ator: Admin, atual: Viewer, novo: Member },
    ])(
      'permite: $ator muda $atual para $novo',
      async ({ ator, atual, novo }) => {
        accessService.requireRole.mockResolvedValue(ator);
        membersRepository.findByProjectAndUser.mockResolvedValue(alvo(atual));

        const result = await service.updateRole(
          PROJECT_ID,
          ACTOR_ID,
          TARGET_ID,
          { role: novo },
        );

        expect(result.role).toBe(novo);
        expect(membersRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ role: novo }),
        );
      },
    );

    it.each([Owner, Admin])(
      '%s não pode se promover a owner nem atribuir owner a outro (400)',
      async (ator) => {
        accessService.requireRole.mockResolvedValue(ator);
        membersRepository.findByProjectAndUser.mockResolvedValue(alvo(Member));

        await expect(
          service.updateRole(PROJECT_ID, ACTOR_ID, TARGET_ID, { role: Owner }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(membersRepository.save).not.toHaveBeenCalled();
      },
    );

    it.each([Owner, Admin])(
      '%s não altera o próprio papel (400)',
      async (ator) => {
        accessService.requireRole.mockResolvedValue(ator);

        const promise = service.updateRole(PROJECT_ID, ACTOR_ID, ACTOR_ID, {
          role: Viewer,
        });

        await expect(promise).rejects.toBeInstanceOf(BadRequestException);
        await expect(promise).rejects.toThrow(
          'Você não pode alterar o seu próprio papel no projeto.',
        );
        expect(membersRepository.save).not.toHaveBeenCalled();
      },
    );

    it.each([
      { ator: Owner, novo: Admin },
      { ator: Owner, novo: Member },
      { ator: Owner, novo: Viewer },
      { ator: Admin, novo: Member },
      { ator: Admin, novo: Viewer },
    ])(
      'o papel do owner é intocável: $ator tentando mudar o owner para $novo recebe 403',
      async ({ ator, novo }) => {
        accessService.requireRole.mockResolvedValue(ator);
        membersRepository.findByProjectAndUser.mockResolvedValue(alvo(Owner));

        const promise = service.updateRole(PROJECT_ID, ACTOR_ID, TARGET_ID, {
          role: novo,
        });

        await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
        await expect(promise).rejects.toThrow(
          'O papel do proprietário do projeto não pode ser alterado.',
        );
        expect(membersRepository.save).not.toHaveBeenCalled();
      },
    );

    it.each([Member, Viewer])(
      'admin não atribui admin a %s (403)',
      async (atual) => {
        accessService.requireRole.mockResolvedValue(Admin);
        membersRepository.findByProjectAndUser.mockResolvedValue(alvo(atual));

        await expect(
          service.updateRole(PROJECT_ID, ACTOR_ID, TARGET_ID, { role: Admin }),
        ).rejects.toBeInstanceOf(ForbiddenException);
        expect(membersRepository.save).not.toHaveBeenCalled();
      },
    );

    it.each([Member, Viewer])(
      'admin não rebaixa outro admin para %s (403)',
      async (novo) => {
        accessService.requireRole.mockResolvedValue(Admin);
        membersRepository.findByProjectAndUser.mockResolvedValue(alvo(Admin));

        const promise = service.updateRole(PROJECT_ID, ACTOR_ID, TARGET_ID, {
          role: novo,
        });

        await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
        await expect(promise).rejects.toThrow(
          'Administradores só podem alterar o papel de membros com papel membro ou visualizador.',
        );
        expect(membersRepository.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('remove', () => {
    it.each([
      { ator: Owner, alvo: Admin },
      { ator: Owner, alvo: Member },
      { ator: Owner, alvo: Viewer },
      { ator: Admin, alvo: Member },
      { ator: Admin, alvo: Viewer },
    ])(
      'permite: $ator remove $alvo, desatribuindo as tarefas na mesma operação',
      async (caso) => {
        accessService.requireRole.mockResolvedValue(caso.ator);
        const membro = alvo(caso.alvo);
        membersRepository.findByProjectAndUser.mockResolvedValue(membro);

        await service.remove(PROJECT_ID, ACTOR_ID, TARGET_ID);

        expect(membersRepository.removeAndUnassignTasks).toHaveBeenCalledWith(
          membro,
        );
      },
    );

    it.each([Owner, Admin])('%s não remove o owner (403)', async (ator) => {
      accessService.requireRole.mockResolvedValue(ator);
      membersRepository.findByProjectAndUser.mockResolvedValue(alvo(Owner));

      const promise = service.remove(PROJECT_ID, ACTOR_ID, TARGET_ID);

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'O proprietário do projeto não pode ser removido.',
      );
      expect(membersRepository.removeAndUnassignTasks).not.toHaveBeenCalled();
    });

    it('admin não remove outro admin (403)', async () => {
      accessService.requireRole.mockResolvedValue(Admin);
      membersRepository.findByProjectAndUser.mockResolvedValue(alvo(Admin));

      const promise = service.remove(PROJECT_ID, ACTOR_ID, TARGET_ID);

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'Administradores só podem remover membros com papel membro ou visualizador.',
      );
      expect(membersRepository.removeAndUnassignTasks).not.toHaveBeenCalled();
    });

    it.each([Owner, Admin])('%s não remove a si mesmo (400)', async (ator) => {
      accessService.requireRole.mockResolvedValue(ator);

      const promise = service.remove(PROJECT_ID, ACTOR_ID, ACTOR_ID);

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(
        'Você não pode remover a si mesmo do projeto.',
      );
      expect(membersRepository.removeAndUnassignTasks).not.toHaveBeenCalled();
    });

    it('viewer e member nem chegam às regras: o acesso é negado antes', async () => {
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(
        service.remove(PROJECT_ID, ACTOR_ID, TARGET_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        ACTOR_ID,
        [Owner, Admin],
      );
      expect(membersRepository.findByProjectAndUser).not.toHaveBeenCalled();
    });
  });
});
