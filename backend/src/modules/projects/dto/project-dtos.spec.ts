import { ProjectRole } from '../../../common/enums/project-role.enum.js';
import { validarDto } from '../../../../test/utils/validation.js';
import { AddMemberDto } from './add-member.dto.js';
import { CreateProjectDto } from './create-project.dto.js';
import { ListMembersQueryDto } from './list-members-query.dto.js';
import { ListProjectsQueryDto } from './list-projects-query.dto.js';
import { UpdateMemberRoleDto } from './update-member-role.dto.js';
import { UpdateProjectDto } from './update-project.dto.js';

describe('CreateProjectDto', () => {
  it('aceita nome e descrição válidos e aplica trim', async () => {
    const result = await validarDto(CreateProjectDto, {
      name: '  Projeto Alpha  ',
      description: ' Descrição ',
    });

    expect(result.valido).toBe(true);
    expect(result.instancia).toMatchObject({
      name: 'Projeto Alpha',
      description: 'Descrição',
    });
  });

  it('rejeita nome só com espaços', async () => {
    const result = await validarDto(CreateProjectDto, { name: '   ' });

    expect(result.mensagens).toEqual(['O campo "Nome" não pode estar vazio.']);
  });

  it('rejeita nome ausente', async () => {
    const result = await validarDto(CreateProjectDto, {});

    expect(result.mensagens).toEqual(['O campo "Nome" não pode estar vazio.']);
  });

  it('aceita nome com 120 caracteres e rejeita com 130', async () => {
    expect(
      (await validarDto(CreateProjectDto, { name: 'a'.repeat(120) })).valido,
    ).toBe(true);

    const result = await validarDto(CreateProjectDto, {
      name: 'a'.repeat(130),
    });
    expect(result.mensagens).toEqual([
      'O campo "Nome" deve ter no máximo 120 caracteres.',
    ]);
  });

  it('rejeita descrição acima de 2000 caracteres', async () => {
    const result = await validarDto(CreateProjectDto, {
      name: 'Ok',
      description: 'a'.repeat(2001),
    });

    expect(result.mensagens).toEqual([
      'O campo "Descrição" deve ter no máximo 2000 caracteres.',
    ]);
  });

  it('descrição vazia vira null', async () => {
    const result = await validarDto(CreateProjectDto, {
      name: 'Ok',
      description: '   ',
    });

    expect(result.instancia?.description).toBeNull();
  });

  it('rejeita campos fora da whitelist', async () => {
    const result = await validarDto(CreateProjectDto, {
      name: 'Ok',
      ownerId: 'x',
    });

    expect(result.mensagens).toEqual(['O campo "ownerId" não é permitido.']);
  });
});

describe('UpdateProjectDto', () => {
  it('aceita corpo vazio (nenhum campo alterado)', async () => {
    expect((await validarDto(UpdateProjectDto, {})).valido).toBe(true);
  });

  it('rejeita nome vazio quando enviado', async () => {
    const result = await validarDto(UpdateProjectDto, { name: '  ' });

    expect(result.mensagens).toEqual(['O campo "Nome" não pode estar vazio.']);
  });

  it('aceita limpar a descrição com null', async () => {
    const result = await validarDto(UpdateProjectDto, { description: null });

    expect(result.valido).toBe(true);
    expect(result.instancia?.description).toBeNull();
  });
});

describe('AddMemberDto / UpdateMemberRoleDto', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  it('aceita userId UUID e papel válido', async () => {
    expect(
      (await validarDto(AddMemberDto, { userId, role: ProjectRole.Viewer }))
        .valido,
    ).toBe(true);
    expect(
      (await validarDto(UpdateMemberRoleDto, { role: ProjectRole.Admin }))
        .valido,
    ).toBe(true);
  });

  it('rejeita userId que não é UUID e papel desconhecido', async () => {
    const result = await validarDto(AddMemberDto, {
      userId: '123',
      role: 'chefe',
    });

    expect(result.mensagens).toEqual([
      'O campo "Usuário" deve ser um identificador válido (UUID).',
      'O campo "Papel" deve ser um dos valores: owner, admin, member, viewer.',
    ]);
  });
});

describe('ListProjectsQueryDto', () => {
  it('aplica os padrões de paginação', async () => {
    const result = await validarDto(ListProjectsQueryDto, {}, 'query');

    expect(result.instancia).toMatchObject({ page: 1, limit: 15 });
  });

  it('converte page e limit de texto para número', async () => {
    const result = await validarDto(
      ListProjectsQueryDto,
      { page: '2', limit: '50' },
      'query',
    );

    expect(result.instancia).toMatchObject({ page: 2, limit: 50 });
  });

  it('rejeita limit acima de 100, limit 0 e page 0', async () => {
    expect(
      (await validarDto(ListProjectsQueryDto, { limit: '101' }, 'query'))
        .mensagens,
    ).toEqual(['O campo "Limite" deve ser menor ou igual a 100.']);
    expect(
      (await validarDto(ListProjectsQueryDto, { limit: '0' }, 'query'))
        .mensagens,
    ).toEqual(['O campo "Limite" deve ser maior ou igual a 1.']);
    expect(
      (await validarDto(ListProjectsQueryDto, { page: '0' }, 'query'))
        .mensagens,
    ).toEqual(['O campo "Página" deve ser maior ou igual a 1.']);
  });

  it('rejeita page decimal ou não numérica', async () => {
    expect(
      (await validarDto(ListProjectsQueryDto, { page: '1.5' }, 'query')).valido,
    ).toBe(false);
    expect(
      (await validarDto(ListProjectsQueryDto, { page: 'abc' }, 'query')).valido,
    ).toBe(false);
  });

  it('só aceita sortBy da whitelist e order asc/desc', async () => {
    expect(
      (
        await validarDto(
          ListProjectsQueryDto,
          { sortBy: 'createdAt', order: 'desc' },
          'query',
        )
      ).valido,
    ).toBe(true);

    expect(
      (
        await validarDto(
          ListProjectsQueryDto,
          { sortBy: 'password; DROP TABLE x' },
          'query',
        )
      ).mensagens,
    ).toEqual([
      'O campo "Ordenar por" deve ser um dos valores: name, createdAt, updatedAt.',
    ]);
    expect(
      (await validarDto(ListProjectsQueryDto, { order: 'up' }, 'query'))
        .mensagens,
    ).toEqual(['O campo "Ordem" deve ser um dos valores: asc, desc.']);
  });

  it('busca vazia é descartada e busca longa é rejeitada', async () => {
    expect(
      (await validarDto(ListProjectsQueryDto, { search: '   ' }, 'query'))
        .instancia?.search,
    ).toBeUndefined();
    expect(
      (
        await validarDto(
          ListProjectsQueryDto,
          { search: 'a'.repeat(201) },
          'query',
        )
      ).mensagens,
    ).toEqual(['O campo "Busca" deve ter no máximo 200 caracteres.']);
  });
});

describe('ListMembersQueryDto', () => {
  it('filtra por papel válido e rejeita papel inexistente', async () => {
    expect(
      (await validarDto(ListMembersQueryDto, { role: 'member' }, 'query'))
        .valido,
    ).toBe(true);
    expect(
      (await validarDto(ListMembersQueryDto, { role: 'dono' }, 'query')).valido,
    ).toBe(false);
  });
});
