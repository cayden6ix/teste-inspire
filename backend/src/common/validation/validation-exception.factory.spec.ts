import { BadRequestException } from '@nestjs/common';
import {
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  buildValidationException,
  translateValidationErrors,
} from './validation-exception.factory.js';
import { createValidationPipe } from './validation.pipe.js';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto.js';
import { ListTasksQueryDto } from '../../modules/tasks/dto/list-tasks-query.dto.js';
import { ReportsQueryDto } from '../../modules/reports/dto/reports-query.dto.js';

class AmostraDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(5)
  name: string;

  @IsInt()
  @Min(1)
  @Max(100)
  limit: number;
}

class EmailDto {
  @IsEmail()
  email: string;
}

/** O mesmo ValidationPipe global da API (app.setup.ts). */
const pipe = createValidationPipe();

async function mensagens(
  value: unknown,
  metatype: new () => object,
): Promise<string[]> {
  try {
    await pipe.transform(value, { type: 'body', metatype });
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (
      (error as BadRequestException).getResponse() as { message: string[] }
    ).message;
  }
  throw new Error('A validação deveria ter falhado.');
}

describe('buildValidationException', () => {
  it('devolve BadRequestException com as mensagens traduzidas', () => {
    const exception = buildValidationException([
      { property: 'email', constraints: { isEmail: 'email must be an email' } },
    ]);

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toMatchObject({
      message: ['O campo "E-mail" deve ser um e-mail válido.'],
    });
  });
});

describe('translateValidationErrors', () => {
  it('usa o rótulo amigável do campo e o texto da regra', async () => {
    expect(await mensagens({ email: 'invalido' }, EmailDto)).toEqual([
      'O campo "E-mail" deve ser um e-mail válido.',
    ]);
  });

  it('usa o nome da propriedade quando não há rótulo', () => {
    expect(
      translateValidationErrors([
        {
          property: 'campoNovo',
          constraints: { isString: 'campoNovo must be a string' },
        },
      ]),
    ).toEqual(['O campo "campoNovo" deve ser um texto.']);
  });

  it('usa o texto genérico para uma regra sem template', () => {
    expect(
      translateValidationErrors([
        { property: 'name', constraints: { regraDesconhecida: 'name falhou' } },
      ]),
    ).toEqual(['O campo "Nome" é inválido.']);
  });

  it('preenche {n} com o limite da regra (min, max e maxLength)', async () => {
    expect(
      await mensagens({ name: 'abcdefgh', limit: 101 }, AmostraDto),
    ).toEqual([
      'O campo "Nome" deve ter no máximo 5 caracteres.',
      'O campo "Limite" deve ser menor ou igual a 100.',
    ]);
    expect(await mensagens({ name: 'ok', limit: 0 }, AmostraDto)).toEqual([
      'O campo "Limite" deve ser maior ou igual a 1.',
    ]);
  });

  it('preenche {values} com os valores permitidos de um enum', async () => {
    expect(await mensagens({ groupBy: 'mes' }, ReportsQueryDto)).toEqual([
      'O campo "Agrupar por" deve ser um dos valores: status, user.',
    ]);
  });

  it('dá prioridade a "vazio" sobre tipo e tamanho: uma única mensagem por campo', async () => {
    // Ausente viola IsNotEmpty e IsString (e MaxLength); só "vazio" aparece.
    expect(await mensagens({ name: undefined, limit: 1 }, AmostraDto)).toEqual([
      'O campo "Nome" não pode estar vazio.',
    ]);
    expect(await mensagens({ name: '', limit: 1 }, AmostraDto)).toEqual([
      'O campo "Nome" não pode estar vazio.',
    ]);
  });

  it('dá prioridade ao tipo sobre os limites: "abc" em campo inteiro mostra só o tipo', async () => {
    // 'abc' (texto) viola IsInt, Min e Max ao mesmo tempo.
    expect(await mensagens({ name: 'ok', limit: 'abc' }, AmostraDto)).toEqual([
      'O campo "Limite" deve ser um número inteiro.',
    ]);
  });

  it('não repete mensagens: cada campo aparece uma vez', async () => {
    const result = await mensagens(
      { name: undefined, limit: 'abc' },
      AmostraDto,
    );

    expect(result).toHaveLength(2);
    expect(new Set(result).size).toBe(2);
  });

  it('informa campo não permitido (whitelist) com o nome do campo', async () => {
    expect(
      await mensagens({ email: 'a@b.com', admin: true }, EmailDto),
    ).toEqual(['O campo "admin" não é permitido.']);
  });

  it('mostra uma única mensagem, com o formato esperado, para data fora do padrão', async () => {
    const result = await mensagens(
      { dueFrom: '2026/01/01' },
      ListTasksQueryDto,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/^O campo "Data limite inicial" .*AAAA-MM-DD.$/);
  });

  it('valida o cadastro: e-mail inválido e senha curta, em português', async () => {
    const result = await mensagens(
      { email: 'x', password: '123', name: 'Ana' },
      CreateUserDto,
    );

    expect(result).toEqual([
      'O campo "E-mail" deve ser um e-mail válido.',
      'O campo "Senha" deve ter no mínimo 6 caracteres.',
    ]);
  });

  it('ignora erros sem constraints (ex.: aninhados) em vez de quebrar', () => {
    expect(
      translateValidationErrors([
        { property: 'filho', children: [], constraints: undefined },
      ]),
    ).toEqual([]);
  });
});
