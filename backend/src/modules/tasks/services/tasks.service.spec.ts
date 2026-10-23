import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { SortOrder } from '../../../common/enums/sort-order.enum.js';
import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { ProjectAccessService } from '../../projects/services/project-access.service.js';
import { UsersService } from '../../users/services/users.service.js';
import { TasksRepository } from '../repositories/tasks.repository.js';
import { TasksCsvService } from './tasks-csv.service.js';
import { TasksService } from './tasks.service.js';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ACTOR_ID = '22222222-2222-4222-8222-222222222222';
const TASK_ID = '33333333-3333-4333-8333-333333333333';
const ASSIGNEE_ID = '44444444-4444-4444-8444-444444444444';

const CABECALHO = 'titulo,descricao,status,responsavel_email,data_limite';

function tarefaSalva(dados: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    projectId: PROJECT_ID,
    title: 'Tarefa',
    description: null,
    status: TaskStatus.Pendente,
    assigneeId: null,
    assignee: null,
    dueDate: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...dados,
  };
}

describe('TasksService', () => {
  let service: TasksService;

  const tasksRepository = {
    findPageByProject: vi.fn(),
    findByProjectAndId: vi.fn(),
    findByProject: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    insertInBatches: vi.fn(),
    countByStatus: vi.fn(),
    countByAssignee: vi.fn(),
  };
  const accessService = {
    requireRole: vi.fn(),
    isMember: vi.fn(),
    getMemberIdsByEmail: vi.fn(),
  };
  const usersService = { findRegisteredEmails: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    accessService.requireRole.mockResolvedValue(ProjectRole.Owner);
    tasksRepository.create.mockImplementation((data: object) => ({ ...data }));
    tasksRepository.save.mockImplementation(async (data: unknown) => data);
    tasksRepository.insertInBatches.mockImplementation(
      async (tasks: unknown[]) => tasks.length,
    );
    accessService.getMemberIdsByEmail.mockResolvedValue(new Map());
    usersService.findRegisteredEmails.mockResolvedValue(new Set());

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        TasksCsvService,
        { provide: TasksRepository, useValue: tasksRepository },
        { provide: ProjectAccessService, useValue: accessService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  describe('list', () => {
    it('usa createdAt desc como ordenação padrão e monta o envelope paginado', async () => {
      tasksRepository.findPageByProject.mockResolvedValue([
        [tarefaSalva()],
        31,
      ]);

      const result = await service.list(PROJECT_ID, ACTOR_ID, {
        page: 3,
        limit: 10,
        status: TaskStatus.Pendente,
        search: 'api',
      });

      expect(tasksRepository.findPageByProject).toHaveBeenCalledWith(
        PROJECT_ID,
        expect.objectContaining({ status: TaskStatus.Pendente, search: 'api' }),
        { sortBy: 'createdAt', order: SortOrder.Desc },
        expect.objectContaining({ page: 3, limit: 10 }),
      );
      expect(result.meta).toEqual({
        page: 3,
        limit: 10,
        total: 31,
        totalPages: 4,
      });
      expect(result.data[0]).toMatchObject({ id: TASK_ID, assigneeName: null });
    });

    it('rejeita data limite inicial posterior à final', async () => {
      const promise = service.list(PROJECT_ID, ACTOR_ID, {
        page: 1,
        limit: 15,
        dueFrom: '2026-12-31',
        dueTo: '2026-01-01',
      });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(
        'A data limite inicial não pode ser posterior à data limite final.',
      );
      expect(tasksRepository.findPageByProject).not.toHaveBeenCalled();
    });

    it('aceita intervalo com as duas datas iguais', async () => {
      tasksRepository.findPageByProject.mockResolvedValue([[], 0]);

      const result = await service.list(PROJECT_ID, ACTOR_ID, {
        page: 1,
        limit: 15,
        dueFrom: '2026-05-10',
        dueTo: '2026-05-10',
      });

      expect(result.meta.totalPages).toBe(0);
    });

    it('não consulta tarefas quando o ator não tem acesso', async () => {
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(
        service.list(PROJECT_ID, ACTOR_ID, { page: 1, limit: 15 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(tasksRepository.findPageByProject).not.toHaveBeenCalled();
    });
  });

  describe('findOne / update / remove', () => {
    it('findOne devolve 404 quando a tarefa não é do projeto', async () => {
      tasksRepository.findByProjectAndId.mockResolvedValue(null);

      await expect(
        service.findOne(PROJECT_ID, TASK_ID, ACTOR_ID),
      ).rejects.toThrow('Tarefa não encontrada.');
      expect(tasksRepository.findByProjectAndId).toHaveBeenCalledWith(
        PROJECT_ID,
        TASK_ID,
      );
    });

    it('update altera só os campos enviados', async () => {
      const existente = tarefaSalva({ title: 'Antigo', description: 'Texto' });
      tasksRepository.findByProjectAndId.mockResolvedValue(existente);

      const result = await service.update(PROJECT_ID, TASK_ID, ACTOR_ID, {
        status: TaskStatus.Concluida,
      });

      expect(existente.title).toBe('Antigo');
      expect(existente.description).toBe('Texto');
      expect(result.status).toBe(TaskStatus.Concluida);
    });

    it('update com assigneeId null remove o responsável sem consultar membros', async () => {
      const existente = tarefaSalva({ assigneeId: ASSIGNEE_ID });
      tasksRepository.findByProjectAndId.mockResolvedValue(existente);

      await service.update(PROJECT_ID, TASK_ID, ACTOR_ID, { assigneeId: null });

      expect(existente.assigneeId).toBeNull();
      expect(accessService.isMember).not.toHaveBeenCalled();
    });

    it('update devolve 404 quando a tarefa não existe', async () => {
      tasksRepository.findByProjectAndId.mockResolvedValue(null);

      await expect(
        service.update(PROJECT_ID, TASK_ID, ACTOR_ID, { title: 'Novo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tasksRepository.save).not.toHaveBeenCalled();
    });

    it('remove apaga pelo id da tarefa encontrada no projeto', async () => {
      tasksRepository.findByProjectAndId.mockResolvedValue(tarefaSalva());

      await service.remove(PROJECT_ID, TASK_ID, ACTOR_ID);

      expect(tasksRepository.delete).toHaveBeenCalledWith(TASK_ID);
    });

    it('remove devolve 404 quando a tarefa é de outro projeto', async () => {
      tasksRepository.findByProjectAndId.mockResolvedValue(null);

      await expect(
        service.remove(PROJECT_ID, TASK_ID, ACTOR_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tasksRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('cria com status pendente e sem responsável por padrão', async () => {
      tasksRepository.findByProjectAndId.mockResolvedValue(null);

      await service.create(PROJECT_ID, ACTOR_ID, { title: 'Nova' });

      expect(tasksRepository.create).toHaveBeenCalledWith({
        projectId: PROJECT_ID,
        title: 'Nova',
        description: null,
        status: TaskStatus.Pendente,
        assigneeId: null,
        dueDate: null,
      });
    });

    it('exige que o responsável seja membro do projeto', async () => {
      accessService.isMember.mockResolvedValue(false);

      const promise = service.create(PROJECT_ID, ACTOR_ID, {
        title: 'Nova',
        assigneeId: ASSIGNEE_ID,
      });

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(
        'O responsável precisa ser membro do projeto.',
      );
      expect(tasksRepository.save).not.toHaveBeenCalled();
    });

    it('viewer não cria tarefa', async () => {
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(
        service.create(PROJECT_ID, ACTOR_ID, { title: 'Nova' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        ACTOR_ID,
        [ProjectRole.Owner, ProjectRole.Admin, ProjectRole.Member],
      );
    });
  });

  describe('exportCsv', () => {
    it('serializa as tarefas do projeto, com leitura liberada até para viewer', async () => {
      tasksRepository.findByProject.mockResolvedValue([
        tarefaSalva({ title: 'Exportada' }),
      ]);

      const csv = await service.exportCsv(PROJECT_ID, ACTOR_ID);

      // UTF-8 com BOM (D-030), para o Excel reconhecer os acentos.
      expect(csv).toBe(`\uFEFF${CABECALHO}\nExportada,,pendente,,\n`);
      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        ACTOR_ID,
        expect.arrayContaining([ProjectRole.Viewer]),
      );
    });
  });

  describe('importCsv', () => {
    const importar = (linhas: string[]) =>
      service.importCsv(
        PROJECT_ID,
        ACTOR_ID,
        [CABECALHO, ...linhas].join('\n'),
      );

    it('exige papel de escrita (viewer não importa)', async () => {
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(importar(['A,,,,'])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(accessService.requireRole).toHaveBeenCalledWith(
        PROJECT_ID,
        ACTOR_ID,
        [ProjectRole.Owner, ProjectRole.Admin, ProjectRole.Member],
      );
      expect(tasksRepository.insertInBatches).not.toHaveBeenCalled();
    });

    it('arquivo só com cabeçalho é 400 e não chama o banco', async () => {
      await expect(importar([])).rejects.toThrow(
        'O arquivo enviado não parece ser um CSV válido: não há nenhuma linha de tarefa depois do cabeçalho.',
      );
      expect(accessService.getMemberIdsByEmail).not.toHaveBeenCalled();
      expect(tasksRepository.insertInBatches).not.toHaveBeenCalled();
    });

    it('cabeçalho sem "titulo" é 400, checado só depois da permissão', async () => {
      const promise = service.importCsv(PROJECT_ID, ACTOR_ID, 'foo,bar\n1,2\n');

      await expect(promise).rejects.toBeInstanceOf(BadRequestException);
      await expect(promise).rejects.toThrow(/^Cabeçalho inválido/);
      expect(accessService.requireRole).toHaveBeenCalled();
      expect(tasksRepository.insertInBatches).not.toHaveBeenCalled();
    });

    it('quem não pode importar recebe o erro de acesso antes da análise do arquivo', async () => {
      accessService.requireRole.mockRejectedValue(new ForbiddenException());

      await expect(
        service.importCsv(PROJECT_ID, ACTOR_ID, '\u0000binario'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejeita linha sem título, com o número da linha do arquivo', async () => {
      const result = await importar(['  ,sem titulo,pendente,,']);

      expect(result).toEqual({
        created: 0,
        errors: [{ row: 2, message: 'O título é obrigatório.' }],
      });
    });

    it('rejeita status inválido', async () => {
      const result = await importar(['A,,feito,,']);

      expect(result.errors).toEqual([
        {
          row: 2,
          message:
            'Status inválido: "feito". Use: pendente, em_andamento ou concluida.',
        },
      ]);
      expect(tasksRepository.insertInBatches).not.toHaveBeenCalled();
    });

    it('aceita variações de escrita do status (maiúsculas, espaços, acento, hífen)', async () => {
      const result = await importar([
        'A,,Em Andamento,,',
        'B,,em andamento,,',
        'C,, PENDENTE ,,',
        'D,,Concluída,,',
        'E,,concluida,,',
        'F,,em-andamento,,',
      ]);

      expect(result).toEqual({ created: 6, errors: [] });
      const salvas = tasksRepository.insertInBatches.mock
        .calls[0]?.[0] as Array<Record<string, unknown>>;
      expect(salvas.map((t) => t['status'])).toEqual([
        TaskStatus.EmAndamento,
        TaskStatus.EmAndamento,
        TaskStatus.Pendente,
        TaskStatus.Concluida,
        TaskStatus.Concluida,
        TaskStatus.EmAndamento,
      ]);
    });

    it('rejeita data limite fora do formato AAAA-MM-DD', async () => {
      const result = await importar(['A,,pendente,,31/12/2026']);

      expect(result.errors).toEqual([
        {
          row: 2,
          message:
            'Data limite inválida: 31/12/2026. Use o formato AAAA-MM-DD.',
        },
      ]);
    });

    it('rejeita e-mail de usuário inexistente', async () => {
      const result = await importar(['A,,pendente,fantasma@empresa.com,']);

      expect(result.errors).toEqual([
        { row: 2, message: 'Usuário não encontrado: fantasma@empresa.com.' },
      ]);
    });

    it('rejeita responsável que existe mas não é membro do projeto', async () => {
      usersService.findRegisteredEmails.mockResolvedValue(
        new Set(['ana@empresa.com']),
      );

      const result = await importar(['A,,pendente,ana@empresa.com,']);

      expect(result.errors).toEqual([
        {
          row: 2,
          message: 'Responsável não é membro do projeto: ana@empresa.com.',
        },
      ]);
      expect(usersService.findRegisteredEmails).toHaveBeenCalledWith([
        'ana@empresa.com',
      ]);
    });

    it('importa as linhas válidas e devolve as inválidas em errors[], sem interromper', async () => {
      accessService.getMemberIdsByEmail.mockResolvedValue(
        new Map([['ana@empresa.com', ASSIGNEE_ID]]),
      );

      const result = await importar([
        'Primeira,Detalhe,em_andamento,ANA@Empresa.com,2026-11-01',
        ',sem titulo,pendente,,',
        'Terceira,,concluida,,',
        'Quarta,,inexistente,,',
        'Quinta,,,,',
      ]);

      expect(result.created).toBe(3);
      expect(result.errors).toEqual([
        { row: 3, message: 'O título é obrigatório.' },
        {
          row: 5,
          message:
            'Status inválido: "inexistente". Use: pendente, em_andamento ou concluida.',
        },
      ]);

      const salvas = tasksRepository.insertInBatches.mock
        .calls[0]?.[0] as Array<Record<string, unknown>>;
      expect(salvas.map((t) => t['title'])).toEqual([
        'Primeira',
        'Terceira',
        'Quinta',
      ]);
      expect(salvas[0]).toMatchObject({
        projectId: PROJECT_ID,
        description: 'Detalhe',
        status: TaskStatus.EmAndamento,
        assigneeId: ASSIGNEE_ID,
        dueDate: '2026-11-01',
      });
    });

    it('título acima de 200 e descrição acima de 4000 caracteres são erros de linha', async () => {
      const result = await importar([
        `${'T'.repeat(201)},,,,`,
        `Ok,${'d'.repeat(4001)},,,`,
        `${'T'.repeat(200)},${'d'.repeat(4000)},,,`,
      ]);

      expect(result.created).toBe(1);
      expect(result.errors).toEqual([
        { row: 2, message: 'O título deve ter no máximo 200 caracteres.' },
        { row: 3, message: 'A descrição deve ter no máximo 4000 caracteres.' },
      ]);
    });

    it.each(['2026-02-30', '2026-13-01', '2025-02-29'])(
      'data inexistente %s é erro de linha; 2028-02-29 é aceita',
      async (data) => {
        const result = await importar([
          `Ruim,,,,${data}`,
          'Bissexta,,,,2028-02-29',
        ]);

        expect(result.created).toBe(1);
        expect(result.errors).toEqual([
          {
            row: 2,
            message: `Data limite inválida: ${data}. Use o formato AAAA-MM-DD.`,
          },
        ]);
      },
    );

    it('mais de 5000 linhas devolvem 400 sem gravar nada', async () => {
      const linhas = Array.from({ length: 5001 }, (_, i) => `T${i},,,,`);

      await expect(importar(linhas)).rejects.toThrow(
        'O arquivo excede o limite de 5000 linhas por importação.',
      );
      expect(tasksRepository.insertInBatches).not.toHaveBeenCalled();
    });

    it('o limite de 5000 linhas é inclusivo', async () => {
      const linhas = Array.from({ length: 5000 }, (_, i) => `T${i},,,,`);

      await expect(importar(linhas)).resolves.toMatchObject({ created: 5000 });
    });

    it('status vazio vira pendente e campos opcionais vazios viram null', async () => {
      await importar(['Simples,,,,']);

      const gravadas = tasksRepository.insertInBatches.mock
        .calls[0]?.[0] as Array<Record<string, unknown>>;
      expect(gravadas[0]).toMatchObject({
        status: TaskStatus.Pendente,
        description: null,
        assigneeId: null,
        dueDate: null,
      });
    });

    it('grava created_at estritamente crescente, na ordem das linhas do arquivo', async () => {
      await importar(['A,,,,', 'B,,,,', 'C,,,,']);

      const salvas = tasksRepository.insertInBatches.mock
        .calls[0]?.[0] as Array<{ createdAt: Date }>;
      const instantes = salvas.map((t) => t.createdAt.getTime());
      expect(instantes).toEqual([...instantes].sort((x, y) => x - y));
      expect(new Set(instantes).size).toBe(3);
    });
  });
});
