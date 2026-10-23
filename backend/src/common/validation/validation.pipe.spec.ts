import { validarDto } from '../../../test/utils/validation.js';
import { LoginDto } from '../../modules/auth/dto/login.dto.js';
import { AddMemberDto } from '../../modules/projects/dto/add-member.dto.js';
import { CreateProjectDto } from '../../modules/projects/dto/create-project.dto.js';
import { ListProjectsQueryDto } from '../../modules/projects/dto/list-projects-query.dto.js';
import { UpdateMemberRoleDto } from '../../modules/projects/dto/update-member-role.dto.js';
import { UpdateProjectDto } from '../../modules/projects/dto/update-project.dto.js';
import { CreateTaskDto } from '../../modules/tasks/dto/create-task.dto.js';
import { UpdateTaskDto } from '../../modules/tasks/dto/update-task.dto.js';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto.js';

/**
 * O ValidationPipe global NAO converte tipos implicitamente (A4/API-03): um numero ou
 * booleano no corpo JSON nao vira texto em silencio, cai na regra de tipo (400).
 */
describe('createValidationPipe: corpo sem conversão implícita de tipos', () => {
  it.each([
    ['CreateTaskDto.title', CreateTaskDto, { title: 123 }, 'O campo "Título" deve ser um texto.'],
    [
      'CreateTaskDto.description',
      CreateTaskDto,
      { title: 'Ok', description: 42 },
      'O campo "Descrição" deve ser um texto.',
    ],
    ['UpdateTaskDto.title', UpdateTaskDto, { title: 123 }, 'O campo "Título" deve ser um texto.'],
    [
      'UpdateTaskDto.description',
      UpdateTaskDto,
      { description: true },
      'O campo "Descrição" deve ser um texto.',
    ],
    ['CreateProjectDto.name', CreateProjectDto, { name: 2026 }, 'O campo "Nome" deve ser um texto.'],
    [
      'CreateProjectDto.description',
      CreateProjectDto,
      { name: 'Ok', description: 7 },
      'O campo "Descrição" deve ser um texto.',
    ],
    ['UpdateProjectDto.name', UpdateProjectDto, { name: 1 }, 'O campo "Nome" deve ser um texto.'],
    [
      'CreateUserDto.name',
      CreateUserDto,
      { name: 123, email: 'a@b.com', password: 'Senha@123' },
      'O campo "Nome" deve ser um texto.',
    ],
    [
      'CreateUserDto.password',
      CreateUserDto,
      { name: 'Ana', email: 'a@b.com', password: 12345678 },
      'O campo "Senha" deve ser um texto.',
    ],
    [
      'CreateUserDto.email',
      CreateUserDto,
      { name: 'Ana', email: 123, password: 'Senha@123' },
      'O campo "E-mail" deve ser um e-mail válido.',
    ],
    [
      'LoginDto.password',
      LoginDto,
      { email: 'a@b.com', password: 123456 },
      'O campo "Senha" deve ser um texto.',
    ],
  ])('%s numérico/booleano é 400 (não vira texto)', async (_nome, dto, corpo, mensagem) => {
    const result = await validarDto(dto as new () => object, corpo);

    expect(result.valido).toBe(false);
    expect(result.mensagens).toContain(mensagem);
  });

  it.each([
    ['CreateTaskDto.status', CreateTaskDto, { title: 'Ok', status: 1 }, 'O campo "Status"'],
    ['CreateTaskDto.assigneeId', CreateTaskDto, { title: 'Ok', assigneeId: 10 }, 'O campo "Responsável"'],
    ['CreateTaskDto.dueDate', CreateTaskDto, { title: 'Ok', dueDate: 20260101 }, 'O campo "Data limite"'],
    ['AddMemberDto.userId', AddMemberDto, { userId: 1, role: 'member' }, 'O campo "Usuário"'],
    ['UpdateMemberRoleDto.role', UpdateMemberRoleDto, { role: 2 }, 'O campo "Papel"'],
  ])('%s com tipo errado é 400', async (_nome, dto, corpo, campo) => {
    const result = await validarDto(dto as new () => object, corpo);

    expect(result.valido).toBe(false);
    expect(result.mensagens.some((mensagem) => mensagem.startsWith(campo))).toBe(true);
  });

  it('o texto continua aceito e limpo (trim) normalmente', async () => {
    const result = await validarDto(CreateTaskDto, { title: '  123  ' });

    expect(result.valido).toBe(true);
    expect(result.instancia).toMatchObject({ title: '123' });
  });

  it('a query continua convertendo page e limit (texto) em número com @Type', async () => {
    const result = await validarDto(ListProjectsQueryDto, { page: '2', limit: '30' }, 'query');

    expect(result.instancia).toMatchObject({ page: 2, limit: 30 });
  });
});
