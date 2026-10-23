import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { ProjectAccessService } from '../../projects/services/project-access.service.js';
import { TasksService } from '../../tasks/services/tasks.service.js';
import { ReportGroupBy } from '../dto/reports-query.dto.js';
import { ReportsService } from './reports.service.js';

const USER_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('ReportsService', () => {
  let service: ReportsService;

  const tasksService = { countByStatus: vi.fn(), countByAssignee: vi.fn() };
  const accessService = { requireRole: vi.fn(), listProjectIdsOfUser: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    tasksService.countByStatus.mockResolvedValue([]);
    tasksService.countByAssignee.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: TasksService, useValue: tasksService },
        { provide: ProjectAccessService, useValue: accessService },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
  });

  describe('sem filtro de projeto', () => {
    it('devolve zeros para quem não participa de nenhum projeto', async () => {
      accessService.listProjectIdsOfUser.mockResolvedValue([]);

      const report = await service.build(USER_ID);

      expect(report).toEqual({
        groupBy: 'status',
        total: 0,
        byStatus: { pendente: 0, em_andamento: 0, concluida: 0 },
        groups: [
          { key: 'pendente', label: 'Pendente', count: 0 },
          { key: 'em_andamento', label: 'Em andamento', count: 0 },
          { key: 'concluida', label: 'Concluída', count: 0 },
        ],
      });
      expect(tasksService.countByStatus).toHaveBeenCalledWith([]);
    });

    it('conta nos projetos do usuário usando a agregação do banco', async () => {
      accessService.listProjectIdsOfUser.mockResolvedValue(['p1', 'p2']);
      tasksService.countByStatus.mockResolvedValue([
        { status: 'pendente', count: 2 },
        { status: 'concluida', count: 3 },
      ]);

      const report = await service.build(USER_ID, ReportGroupBy.Status);

      expect(tasksService.countByStatus).toHaveBeenCalledWith(['p1', 'p2']);
      expect(tasksService.countByAssignee).not.toHaveBeenCalled();
      expect(report.total).toBe(5);
      expect(report.byStatus).toEqual({
        pendente: 2,
        em_andamento: 0,
        concluida: 3,
      });
      expect(report.groups.map((g) => [g.key, g.count])).toEqual([
        ['pendente', 2],
        ['em_andamento', 0],
        ['concluida', 3],
      ]);
    });
  });

  describe('com filtro de projeto', () => {
    it('exige acesso ao projeto e agrega só nele', async () => {
      accessService.requireRole.mockResolvedValue(ProjectRole.Viewer);
      tasksService.countByStatus.mockResolvedValue([
        { status: 'pendente', count: 1 },
      ]);

      const report = await service.build(
        USER_ID,
        ReportGroupBy.Status,
        PROJECT_ID,
      );

      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        USER_ID,
        expect.arrayContaining([ProjectRole.Viewer]),
      );
      expect(accessService.listProjectIdsOfUser).not.toHaveBeenCalled();
      expect(tasksService.countByStatus).toHaveBeenCalledWith([PROJECT_ID]);
      expect(report.total).toBe(1);
    });

    it('nega o relatório de um projeto do qual o usuário não faz parte', async () => {
      accessService.requireRole.mockRejectedValue(
        new NotFoundException('Projeto não encontrado.'),
      );

      await expect(
        service.build(USER_ID, ReportGroupBy.Status, PROJECT_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tasksService.countByStatus).not.toHaveBeenCalled();
    });
  });

  describe('agrupado por usuário', () => {
    it('monta os grupos do maior para o menor, com "Sem responsável" para assigneeId nulo', async () => {
      accessService.listProjectIdsOfUser.mockResolvedValue(['p1']);
      tasksService.countByStatus.mockResolvedValue([
        { status: 'pendente', count: 5 },
      ]);
      tasksService.countByAssignee.mockResolvedValue([
        { assigneeId: 'bbbb', assigneeName: 'Bruno', count: 1 },
        { assigneeId: null, assigneeName: null, count: 1 },
        { assigneeId: 'aaaa', assigneeName: 'Ana', count: 3 },
      ]);

      const report = await service.build(USER_ID, ReportGroupBy.User);

      expect(report.groupBy).toBe('user');
      expect(report.total).toBe(5);
      expect(report.groups).toEqual([
        { key: 'aaaa', label: 'Ana', count: 3 },
        { key: 'bbbb', label: 'Bruno', count: 1 },
        { key: 'sem_responsavel', label: 'Sem responsável', count: 1 },
      ]);
    });

    it('desempata por nome e depois por chave, de forma estável', async () => {
      accessService.listProjectIdsOfUser.mockResolvedValue(['p1']);
      tasksService.countByAssignee.mockResolvedValue([
        { assigneeId: 'z-id', assigneeName: 'Carla', count: 1 },
        { assigneeId: 'a-id', assigneeName: 'Carla', count: 1 },
        { assigneeId: 'bbbb', assigneeName: 'Bruno', count: 1 },
      ]);

      const report = await service.build(USER_ID, ReportGroupBy.User);

      expect(report.groups.map((g) => g.key)).toEqual(['bbbb', 'a-id', 'z-id']);
    });

    it('mantém byStatus preenchido mesmo agrupando por usuário', async () => {
      accessService.listProjectIdsOfUser.mockResolvedValue(['p1']);
      tasksService.countByStatus.mockResolvedValue([
        { status: 'concluida', count: 1 },
      ]);

      const report = await service.build(USER_ID, ReportGroupBy.User);

      expect(report.byStatus).toEqual({
        pendente: 0,
        em_andamento: 0,
        concluida: 1,
      });
    });
  });
});
