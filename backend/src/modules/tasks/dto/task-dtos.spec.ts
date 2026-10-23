import { TaskStatus } from '../../../common/enums/task-status.enum.js';
import { validarDto } from '../../../../test/utils/validation.js';
import { CreateTaskDto } from './create-task.dto.js';
import { ListTasksQueryDto } from './list-tasks-query.dto.js';
import { UpdateTaskDto } from './update-task.dto.js';

const UUID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

describe('ListTasksQueryDto', () => {
  it('aplica os padrões de paginação sem filtros', async () => {
    const result = await validarDto(ListTasksQueryDto, {}, 'query');

    expect(result.instancia).toMatchObject({ page: 1, limit: 15 });
  });

  it('rejeita limit 101 e aceita limit 100', async () => {
    expect(
      (await validarDto(ListTasksQueryDto, { limit: '100' }, 'query')).valido,
    ).toBe(true);
    expect(
      (await validarDto(ListTasksQueryDto, { limit: '101' }, 'query'))
        .mensagens,
    ).toEqual(['O campo "Limite" deve ser menor ou igual a 100.']);
  });

  it.each(['title', 'status', 'dueDate', 'createdAt', 'updatedAt'])(
    'aceita sortBy=%s',
    async (sortBy) => {
      expect(
        (await validarDto(ListTasksQueryDto, { sortBy }, 'query')).valido,
      ).toBe(true);
    },
  );

  it('rejeita sortBy fora da whitelist (impede interpolar coluna arbitrária)', async () => {
    const result = await validarDto(
      ListTasksQueryDto,
      { sortBy: 'assignee.password' },
      'query',
    );

    expect(result.mensagens).toEqual([
      'O campo "Ordenar por" deve ser um dos valores: title, status, dueDate, createdAt, updatedAt.',
    ]);
  });

  it('valida status, assigneeId e as datas YYYY-MM-DD dos filtros', async () => {
    expect(
      (
        await validarDto(
          ListTasksQueryDto,
          {
            status: 'concluida',
            assigneeId: UUID,
            dueFrom: '2026-01-01',
            dueTo: '2026-12-31',
          },
          'query',
        )
      ).valido,
    ).toBe(true);

    const invalido = await validarDto(
      ListTasksQueryDto,
      {
        status: 'feito',
        assigneeId: '123',
        dueFrom: '01/01/2026',
        dueTo: '2026-02-30T10:00:00Z',
      },
      'query',
    );
    expect(invalido.mensagens).toHaveLength(4);
    expect(invalido.mensagens.slice(0, 2)).toEqual([
      'O campo "Status" deve ser um dos valores: pendente, em_andamento, concluida.',
      'O campo "Responsável" deve ser um identificador válido (UUID).',
    ]);
    expect(invalido.mensagens[2]).toContain('"Data limite inicial"');
    expect(invalido.mensagens[3]).toContain('"Data limite final"');
  });

  it('o intervalo invertido (dueFrom > dueTo) passa pelo DTO e é tratado no TasksService', async () => {
    const result = await validarDto(
      ListTasksQueryDto,
      { dueFrom: '2026-12-31', dueTo: '2026-01-01' },
      'query',
    );

    expect(result.valido).toBe(true);
  });
});

describe('CreateTaskDto', () => {
  it('aceita só o título e aplica trim', async () => {
    const result = await validarDto(CreateTaskDto, {
      title: '  Nova tarefa  ',
    });

    expect(result.instancia?.title).toBe('Nova tarefa');
  });

  it('rejeita título vazio, só com espaços ou acima de 200 caracteres', async () => {
    expect(
      (await validarDto(CreateTaskDto, { title: '   ' })).mensagens,
    ).toEqual(['O campo "Título" não pode estar vazio.']);
    expect(
      (await validarDto(CreateTaskDto, { title: 'a'.repeat(201) })).mensagens,
    ).toEqual(['O campo "Título" deve ter no máximo 200 caracteres.']);
  });

  it('aceita status e responsável válidos e rejeita inválidos', async () => {
    expect(
      (
        await validarDto(CreateTaskDto, {
          title: 'T',
          status: TaskStatus.Concluida,
          assigneeId: UUID,
        })
      ).valido,
    ).toBe(true);
    expect(
      (
        await validarDto(CreateTaskDto, {
          title: 'T',
          status: 'x',
          assigneeId: 'y',
        })
      ).mensagens,
    ).toEqual([
      'O campo "Status" deve ser um dos valores: pendente, em_andamento, concluida.',
      'O campo "Responsável" deve ser um identificador válido (UUID).',
    ]);
  });

  it('rejeita data limite que não é uma data válida', async () => {
    const result = await validarDto(CreateTaskDto, {
      title: 'T',
      dueDate: 'amanhã',
    });

    expect(result.mensagens).toEqual([
      'O campo "Data limite" deve ser uma data válida no formato AAAA-MM-DD.',
    ]);
  });

  it('aceita dueDate e assigneeId nulos (limpar o campo)', async () => {
    expect(
      (
        await validarDto(CreateTaskDto, {
          title: 'T',
          dueDate: null,
          assigneeId: null,
        })
      ).valido,
    ).toBe(true);
  });

  it('rejeita campos fora da whitelist (ex.: projectId no corpo)', async () => {
    const result = await validarDto(CreateTaskDto, {
      title: 'T',
      projectId: UUID,
    });

    expect(result.mensagens).toEqual(['O campo "Projeto" não é permitido.']);
  });
});

describe('UpdateTaskDto', () => {
  it('aceita atualização parcial e corpo vazio', async () => {
    expect((await validarDto(UpdateTaskDto, {})).valido).toBe(true);
    expect(
      (await validarDto(UpdateTaskDto, { status: TaskStatus.EmAndamento }))
        .valido,
    ).toBe(true);
  });

  it('rejeita título vazio quando enviado', async () => {
    expect((await validarDto(UpdateTaskDto, { title: '' })).mensagens).toEqual([
      'O campo "Título" não pode estar vazio.',
    ]);
  });
});
