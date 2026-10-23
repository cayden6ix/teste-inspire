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

describe('limites de tamanho da conta (A5)', () => {
  const valido = { email: 'ana@empresa.com', password: 'Senha@123', name: 'Ana' };

  it('cadastro: nome até 120, e-mail até 254 e senha de 6 a 72 caracteres', async () => {
    expect(
      (
        await validarDto(CreateUserDto, {
          ...valido,
          name: 'N'.repeat(120),
          password: 'p'.repeat(72),
        })
      ).valido,
    ).toBe(true);

    const result = await validarDto(CreateUserDto, {
      email: valido.email,
      name: 'N'.repeat(121),
      password: 'p'.repeat(73),
    });

    expect(result.mensagens).toEqual([
      'O campo "Senha" deve ter no máximo 72 caracteres.',
      'O campo "Nome" deve ter no máximo 120 caracteres.',
    ]);
  });

  it('cadastro: nome e senha com 500 caracteres são recusados', async () => {
    const result = await validarDto(CreateUserDto, {
      email: valido.email,
      name: 'N'.repeat(500),
      password: 'p'.repeat(500),
    });

    expect(result.valido).toBe(false);
    expect(result.mensagens).toHaveLength(2);
  });

  it('cadastro e login: e-mail acima de 254 caracteres é recusado (sem chegar ao banco)', async () => {
    // Local de 64 (máximo da RFC) + domínio com rótulos de 63: e-mail válido, mas longo demais.
    const longo = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`;
    expect(longo.length).toBeGreaterThan(254);

    const cadastro = await validarDto(CreateUserDto, { ...valido, email: longo });
    const login = await validarDto(LoginDto, { email: longo, password: 'x' });

    // O isEmail ja recusa enderecos acima de 254 (e tem prioridade na mensagem); o
    // @MaxLength(254) fica como teto explicito do contrato.
    expect(cadastro.mensagens).toEqual(['O campo "E-mail" deve ser um e-mail válido.']);
    expect(login.mensagens).toEqual(['O campo "E-mail" deve ser um e-mail válido.']);
  });

  it('login: senha acima de 72 caracteres é recusada antes do hash', async () => {
    const result = await validarDto(LoginDto, {
      email: valido.email,
      password: 'p'.repeat(73),
    });

    expect(result.mensagens).toEqual(['O campo "Senha" deve ter no máximo 72 caracteres.']);
  });
});

describe('ListUsersQueryDto: no máximo 10 por página (D-028)', () => {
  it('usa 10 como padrão', async () => {
    const result = await validarDto(ListUsersQueryDto, { email: 'ana' }, 'query');

    expect(result.instancia).toMatchObject({ page: 1, limit: 10 });
  });

  it('aceita limit 10 e recusa 11 e 100', async () => {
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'ana', limit: '10' }, 'query')).valido,
    ).toBe(true);
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'ana', limit: '11' }, 'query')).mensagens,
    ).toEqual(['O campo "Limite" deve ser menor ou igual a 10.']);
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'ana', limit: '100' }, 'query')).mensagens,
    ).toEqual(['O campo "Limite" deve ser menor ou igual a 10.']);
  });

  it('continua recusando limit 0 e texto', async () => {
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'ana', limit: '0' }, 'query')).mensagens,
    ).toEqual(['O campo "Limite" deve ser maior ou igual a 1.']);
    expect(
      (await validarDto(ListUsersQueryDto, { email: 'ana', limit: 'abc' }, 'query')).mensagens,
    ).toEqual(['O campo "Limite" deve ser um número inteiro.']);
  });
});
