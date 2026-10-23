import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { SortOrder } from '../../../common/enums/sort-order.enum.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';
import { ProjectAccessService } from './project-access.service.js';
import { ProjectsService } from './projects.service.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function projeto(dados: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    name: 'Projeto Alpha',
    description: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...dados,
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;

  const projectsRepository = {
    createWithOwner: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    delete: vi.fn(),
  };
  const membersRepository = { findPageByUser: vi.fn() };
  const accessService = { requireRole: vi.fn(), getRole: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsRepository, useValue: projectsRepository },
        { provide: ProjectMembersRepository, useValue: membersRepository },
        { provide: ProjectAccessService, useValue: accessService },
      ],
    }).compile();

    service = moduleRef.get(ProjectsService);
  });

  describe('create', () => {
    it('cria o projeto e o vínculo de owner juntos (transação do repositório) e devolve role owner', async () => {
      projectsRepository.createWithOwner.mockResolvedValue(
        projeto({ name: 'Novo' }),
      );

      const result = await service.create(USER_ID, {
        name: 'Novo',
        description: undefined,
      });

      expect(projectsRepository.createWithOwner).toHaveBeenCalledWith(
        { name: 'Novo', description: null },
        USER_ID,
      );
      expect(result).toMatchObject({
        id: PROJECT_ID,
        name: 'Novo',
        role: 'owner',
      });
    });

    it('propaga a falha da transação sem devolver um projeto', async () => {
      projectsRepository.createWithOwner.mockRejectedValue(
        new Error('falha ao gravar o owner'),
      );

      await expect(service.create(USER_ID, { name: 'Novo' })).rejects.toThrow(
        'falha ao gravar o owner',
      );
    });
  });

  describe('listForUser', () => {
    it('ordena por nome asc por padrão e devolve o papel do usuário em cada projeto', async () => {
      membersRepository.findPageByUser.mockResolvedValue([
        [{ role: ProjectRole.Admin, project: projeto() }],
        1,
      ]);

      const result = await service.listForUser(USER_ID, {
        page: 1,
        limit: 15,
        search: 'alp',
      });

      expect(membersRepository.findPageByUser).toHaveBeenCalledWith(
        USER_ID,
        { search: 'alp' },
        { sortBy: 'name', order: SortOrder.Asc },
        expect.objectContaining({ page: 1, limit: 15 }),
      );
      expect(result.data).toEqual([
        expect.objectContaining({
          id: PROJECT_ID,
          name: 'Projeto Alpha',
          role: 'admin',
        }),
      ]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 15,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('findOneForUser', () => {
    it('devolve 404 para projeto inexistente', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOneForUser(PROJECT_ID, USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('devolve 403 para quem não é membro', async () => {
      projectsRepository.findOne.mockResolvedValue(projeto());
      accessService.getRole.mockResolvedValue(null);

      await expect(
        service.findOneForUser(PROJECT_ID, USER_ID),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('devolve o projeto com o papel do usuário', async () => {
      projectsRepository.findOne.mockResolvedValue(
        projeto({ description: 'Texto' }),
      );
      accessService.getRole.mockResolvedValue(ProjectRole.Viewer);

      await expect(
        service.findOneForUser(PROJECT_ID, USER_ID),
      ).resolves.toMatchObject({
        id: PROJECT_ID,
        description: 'Texto',
        role: 'viewer',
      });
    });
  });

  describe('update', () => {
    it('só altera os campos enviados e exige owner ou admin', async () => {
      const existente = projeto({ description: 'Original' });
      projectsRepository.findOne.mockResolvedValue(existente);
      accessService.requireRole.mockResolvedValue(ProjectRole.Admin);

      const result = await service.update(PROJECT_ID, USER_ID, {
        name: 'Novo nome',
      });

      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        USER_ID,
        [ProjectRole.Owner, ProjectRole.Admin],
      );
      expect(projectsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Novo nome', description: 'Original' }),
      );
      expect(result).toMatchObject({ name: 'Novo nome', role: 'admin' });
    });

    it('permite limpar a descrição com null', async () => {
      projectsRepository.findOne.mockResolvedValue(
        projeto({ description: 'Original' }),
      );
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);

      const result = await service.update(PROJECT_ID, USER_ID, {
        description: null,
      });

      expect(result.description).toBeNull();
    });

    it('não grava quando o papel não permite', async () => {
      projectsRepository.findOne.mockResolvedValue(projeto());
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(
        service.update(PROJECT_ID, USER_ID, { name: 'X' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(projectsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('só o owner exclui', async () => {
      projectsRepository.findOne.mockResolvedValue(projeto());
      accessService.requireRole.mockResolvedValue(ProjectRole.Owner);

      await service.remove(PROJECT_ID, USER_ID);

      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        USER_ID,
        [ProjectRole.Owner],
      );
      expect(projectsRepository.delete).toHaveBeenCalledWith(PROJECT_ID);
    });

    it('admin não exclui o projeto', async () => {
      projectsRepository.findOne.mockResolvedValue(projeto());
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(service.remove(PROJECT_ID, USER_ID)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(projectsRepository.delete).not.toHaveBeenCalled();
    });

    it('devolve 404 quando o projeto não existe', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(PROJECT_ID, USER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
