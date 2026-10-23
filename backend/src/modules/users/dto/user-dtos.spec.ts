import { validarDto } from '../../../../test/utils/validation.js';
import { LoginDto } from '../../auth/dto/login.dto.js';
import { CreateUserDto } from './create-user.dto.js';
import { ListUsersQueryDto } from './list-users-query.dto.js';

describe('CreateUserDto', () => {
  it('normaliza e-mail (trim + minúsculas) e nome (trim)', async () => {
    const result = await validarDto(CreateUserDto, {
      email: '  Ana.Souza@Empresa.COM ',
      password: 'Senha@123',
      name: '  Ana Souza  ',
    });

    expect(result.instancia).toMatchObject({
      email: 'ana.souza@empresa.com',
      name: 'Ana Souza',
    });
  });

  it('rejeita e-mail inválido, senha curta e nome vazio, uma mensagem por campo', async () => {
    const result = await validarDto(CreateUserDto, {
      email: 'sem-arroba',
      password: '12345',
      name: '  ',
    });

    expect(result.mensagens).toEqual([
      'O campo "E-mail" deve ser um e-mail válido.',
      'O campo "Senha" deve ter no mínimo 6 caracteres.',
      'O campo "Nome" não pode estar vazio.',
    ]);
  });

  it('não permite enviar campos como active ou id', async () => {
    const result = await validarDto(CreateUserDto, {
      email: 'a@b.com',
      password: 'Senha@123',
      name: 'Ana',
      active: false,
    });

    expect(result.mensagens).toEqual(['O campo "active" não é permitido.']);
  });
});

describe('LoginDto', () => {
  it('aceita credenciais e converte o e-mail para minúsculas', async () => {
    const result = await validarDto(LoginDto, {
      email: 'ANA@Empresa.com',
      password: 'qualquer',
    });

    expect(result.instancia?.email).toBe('ana@empresa.com');
  });

  it('rejeita e-mail inválido e senha vazia', async () => {
    const result = await validarDto(LoginDto, { email: 'x', password: '' });

    expect(result.mensagens).toEqual([
      'O campo "E-mail" deve ser um e-mail válido.',
      'O campo "Senha" não pode estar vazio.',
    ]);
  });
});

describe('ListUsersQueryDto', () => {
  it('aceita busca por nome e e-mail parcial, com trim', async () => {
    const result = await validarDto(
      ListUsersQueryDto,
      { name: ' Ana ', email: ' ana@emp ' },
      'query',
    );

    expect(result.instancia).toMatchObject({ name: 'Ana', email: 'ana@emp' });
  });

  it('e-mail parcial não precisa ser um e-mail completo', async () => {
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'ana' }, 'query')).valido,
    ).toBe(true);
  });

  it('limita o tamanho dos filtros e a whitelist de ordenação', async () => {
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'a'.repeat(321) }, 'query'))
        .valido,
    ).toBe(false);
    expect(
      (await validarDto(ListUsersQueryDto, { name: 'a'.repeat(201) }, 'query'))
        .valido,
    ).toBe(false);
    expect(
      (await validarDto(ListUsersQueryDto, { sortBy: 'password' }, 'query'))
        .valido,
    ).toBe(false);
    expect(
      (await validarDto(ListUsersQueryDto, { sortBy: 'email' }, 'query'))
        .valido,
    ).toBe(true);
  });
});
