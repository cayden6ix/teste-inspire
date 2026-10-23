import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { ProjectMembersRepository } from '../repositories/project-members.repository.js';
import { ProjectsRepository } from '../repositories/projects.repository.js';
import { ProjectAccessService } from './project-access.service.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('ProjectAccessService', () => {
  let service: ProjectAccessService;
  const projectsRepository = { findOne: vi.fn() };
  const membersRepository = { findByProjectAndUser: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();

    // A DI so resolve se o SWC emitir `design:paramtypes`: os tokens abaixo sao as
    // classes dos parametros do construtor.
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectAccessService,
        { provide: ProjectsRepository, useValue: projectsRepository },
        { provide: ProjectMembersRepository, useValue: membersRepository },
      ],
    }).compile();

    service = moduleRef.get(ProjectAccessService);
  });

  describe('getRole', () => {
    it('devolve o papel do membro', async () => {
      membersRepository.findByProjectAndUser.mockResolvedValue({
        role: ProjectRole.Admin,
      });

      await expect(service.getRole(PROJECT_ID, USER_ID)).resolves.toBe(
        ProjectRole.Admin,
      );
      expect(membersRepository.findByProjectAndUser).toHaveBeenCalledWith(
        PROJECT_ID,
        USER_ID,
      );
    });

    it('devolve null quando o usuario não é membro', async () => {
      membersRepository.findByProjectAndUser.mockResolvedValue(null);

      await expect(service.getRole(PROJECT_ID, USER_ID)).resolves.toBeNull();
    });
  });

  describe('requireRole', () => {
    it('devolve 404 quando o projeto não existe, sem consultar o papel', async () => {
      projectsRepository.findOne.mockResolvedValue(null);

      const promise = service.requireRole(PROJECT_ID, USER_ID, [
        ProjectRole.Owner,
      ]);

      await expect(promise).rejects.toBeInstanceOf(NotFoundException);
      await expect(promise).rejects.toThrow('Projeto não encontrado.');
      expect(membersRepository.findByProjectAndUser).not.toHaveBeenCalled();
    });

    it('devolve 403 quando o usuário não é membro do projeto', async () => {
      projectsRepository.findOne.mockResolvedValue({ id: PROJECT_ID });
      membersRepository.findByProjectAndUser.mockResolvedValue(null);

      const promise = service.requireRole(PROJECT_ID, USER_ID, [
        ProjectRole.Viewer,
      ]);

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'Você não faz parte deste projeto.',
      );
    });

    it('devolve 403 quando o papel não está entre os permitidos', async () => {
      projectsRepository.findOne.mockResolvedValue({ id: PROJECT_ID });
      membersRepository.findByProjectAndUser.mockResolvedValue({
        role: ProjectRole.Viewer,
      });

      const promise = service.requireRole(PROJECT_ID, USER_ID, [
        ProjectRole.Owner,
        ProjectRole.Admin,
        ProjectRole.Member,
      ]);

      await expect(promise).rejects.toBeInstanceOf(ForbiddenException);
      await expect(promise).rejects.toThrow(
        'Seu papel no projeto não permite esta ação.',
      );
    });

    it.each([
      ProjectRole.Owner,
      ProjectRole.Admin,
      ProjectRole.Member,
      ProjectRole.Viewer,
    ])('devolve o papel %s quando ele é permitido', async (role) => {
      projectsRepository.findOne.mockResolvedValue({ id: PROJECT_ID });
      membersRepository.findByProjectAndUser.mockResolvedValue({ role });

      await expect(
        service.requireRole(PROJECT_ID, USER_ID, [role]),
      ).resolves.toBe(role);
      expect(projectsRepository.findOne).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
      });
    });
  });
});

describe('ProjectAccessService: consultas usadas por outros módulos', () => {
  let service: ProjectAccessService;
  const projectsRepository = { findOne: vi.fn() };
  const membersRepository = {
    findByProjectAndUser: vi.fn(),
    findProjectIdsByUser: vi.fn(),
    findMemberEmails: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectAccessService,
        { provide: ProjectsRepository, useValue: projectsRepository },
        { provide: ProjectMembersRepository, useValue: membersRepository },
      ],
    }).compile();

    service = moduleRef.get(ProjectAccessService);
  });

  it('isMember: true para qualquer papel e false para quem não é membro', async () => {
    membersRepository.findByProjectAndUser.mockResolvedValueOnce({
      role: ProjectRole.Viewer,
    });
    membersRepository.findByProjectAndUser.mockResolvedValueOnce(null);

    await expect(service.isMember(PROJECT_ID, USER_ID)).resolves.toBe(true);
    await expect(service.isMember(PROJECT_ID, USER_ID)).resolves.toBe(false);
  });

  it('listProjectIdsOfUser: devolve os ids dos projetos do usuário', async () => {
    membersRepository.findProjectIdsByUser.mockResolvedValue(['p1', 'p2']);

    await expect(service.listProjectIdsOfUser(USER_ID)).resolves.toEqual([
      'p1',
      'p2',
    ]);
    expect(membersRepository.findProjectIdsByUser).toHaveBeenCalledWith(
      USER_ID,
    );
  });

  it('getMemberIdsByEmail: monta o mapa e-mail -> id com uma única consulta', async () => {
    membersRepository.findMemberEmails.mockResolvedValue([
      { userId: 'u1', email: 'ana@empresa.com' },
      { userId: 'u2', email: 'bruno@empresa.com' },
    ]);

    const mapa = await service.getMemberIdsByEmail(PROJECT_ID);

    expect(mapa).toEqual(
      new Map([
        ['ana@empresa.com', 'u1'],
        ['bruno@empresa.com', 'u2'],
      ]),
    );
    expect(membersRepository.findMemberEmails).toHaveBeenCalledTimes(1);
    expect(membersRepository.findMemberEmails).toHaveBeenCalledWith(PROJECT_ID);
  });
});
