import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  INTERNAL_ERROR_MESSAGE,
  ROUTE_NOT_FOUND_MESSAGE,
  STATUS_MESSAGES,
  UPLOAD_TOO_LARGE_MESSAGE,
} from '../messages/http-messages.js';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

interface RequestFake {
  method: string;
  originalUrl: string;
  url: string;
  id?: string;
}

function executar(exception: unknown, request: Partial<RequestFake> = {}) {
  const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  const req: RequestFake = {
    method: 'GET',
    originalUrl: '/api/projects?page=1',
    url: '/projects',
    ...request,
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;

  new AllExceptionsFilter().catch(exception, host);

  return {
    status: response.status.mock.calls[0]?.[0] as number,
    body: response.json.mock.calls[0]?.[0] as Record<string, unknown>,
  };
}

describe('AllExceptionsFilter', () => {
  let loggerError: ReturnType<typeof vi.spyOn>;
  let loggerWarn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loggerError = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    loggerWarn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('monta o corpo padrão: statusCode, error, message, path e timestamp ISO', () => {
    const { status, body } = executar(
      new ConflictException('Este e-mail já está cadastrado.'),
    );

    expect(status).toBe(409);
    expect(body).toEqual({
      statusCode: 409,
      error: 'CONFLICT',
      message: 'Este e-mail já está cadastrado.',
      path: '/api/projects?page=1',
      timestamp: expect.stringMatching(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      ),
    });
  });

  it('usa url quando originalUrl não existe', () => {
    const { body } = executar(
      new NotFoundException('Projeto não encontrado.'),
      {
        originalUrl: undefined,
        url: '/projects/1',
      },
    );

    expect(body['path']).toBe('/projects/1');
  });

  it('preserva a mensagem de domínio de uma HttpException', () => {
    const { status, body } = executar(
      new ForbiddenException('Você não faz parte deste projeto.'),
    );

    expect(status).toBe(403);
    expect(body['message']).toBe('Você não faz parte deste projeto.');
  });

  it('preserva a lista de mensagens de validação sem traduzir de novo', () => {
    const mensagens = [
      'O campo "Nome" não pode estar vazio.',
      'O campo "Limite" é inválido.',
    ];

    const { status, body } = executar(new BadRequestException(mensagens));

    expect(status).toBe(400);
    expect(body['message']).toEqual(mensagens);
  });

  it.each([
    { exception: new BadRequestException(), status: 400 },
    { exception: new UnauthorizedException(), status: 401 },
    { exception: new ForbiddenException(), status: 403 },
    { exception: new NotFoundException(), status: 404 },
    { exception: new ConflictException(), status: 409 },
    { exception: new HttpException('Too Many Requests', 429), status: 429 },
  ])(
    'troca a mensagem padrão em inglês pelo texto em português do status $status',
    ({ exception, status }) => {
      const result = executar(exception);

      expect(result.status).toBe(status);
      expect(result.body['message']).toBe(STATUS_MESSAGES[status]);
    },
  );

  it('traduz rota inexistente do Nest ("Cannot GET /x")', () => {
    const { body } = executar(
      new NotFoundException('Cannot GET /api/inexistente'),
    );

    expect(body['message']).toBe(ROUTE_NOT_FOUND_MESSAGE);
  });

  it('reescreve mensagens técnicas do multer e do parser de JSON', () => {
    expect(
      executar(new PayloadTooLargeException('File too large')).body['message'],
    ).toBe(UPLOAD_TOO_LARGE_MESSAGE);
    expect(
      executar(new BadRequestException('Unexpected field')).body['message'],
    ).toBe('Campo de arquivo inesperado. Envie o arquivo no campo "file".');
    expect(
      executar(
        new BadRequestException('Unexpected token } in JSON at position 3'),
      ).body['message'],
    ).toBe('Corpo da requisição inválido: o JSON está malformado.');
  });

  it('erro 4xx que não é HttpException (body-parser) mantém o status e usa o texto do status', () => {
    const erro = Object.assign(new Error('request entity too large'), {
      status: 413,
    });

    const { status, body } = executar(erro);

    expect(status).toBe(413);
    expect(body['message']).toBe(STATUS_MESSAGES[413]);
    expect(loggerError).not.toHaveBeenCalled();
    expect(loggerWarn).toHaveBeenCalled();
  });

  describe('erros inesperados (500)', () => {
    it('não vaza a mensagem nem a stack do erro original', () => {
      const erro = new Error(
        'connection refused to 10.0.0.5:5432 password=segredo',
      );

      const { status, body } = executar(erro);

      expect(status).toBe(500);
      expect(body['message']).toBe(INTERNAL_ERROR_MESSAGE);
      const serializado = JSON.stringify(body);
      expect(serializado).not.toContain('10.0.0.5');
      expect(serializado).not.toContain('segredo');
      expect(serializado).not.toContain('stack');
      expect(serializado).not.toContain('at ');
    });

    it('registra o erro completo no log do servidor', () => {
      const erro = new Error('falha interna');

      executar(erro);

      expect(loggerError).toHaveBeenCalledWith(
        'GET /api/projects?page=1 -> 500',
        erro.stack,
      );
    });

    it('trata qualquer valor lançado (string, null, objeto) como 500 genérico', () => {
      for (const valor of ['boom', null, undefined, { qualquer: 'coisa' }]) {
        const { status, body } = executar(valor);

        expect(status).toBe(500);
        expect(body['message']).toBe(INTERNAL_ERROR_MESSAGE);
        expect(body['error']).toBe('INTERNAL_SERVER_ERROR');
      }
    });

    it('um status 5xx em objeto que não é HttpException continua sendo 500', () => {
      const { status } = executar(
        Object.assign(new Error('x'), { status: 503 }),
      );

      expect(status).toBe(500);
    });
  });

  describe('requestId', () => {
    it('inclui o requestId quando a requisição tem id', () => {
      const { body } = executar(new NotFoundException(), { id: 'req-123' });

      expect(body['requestId']).toBe('req-123');
    });

    it('omite o campo quando não há id', () => {
      const { body } = executar(new NotFoundException());

      expect(body).not.toHaveProperty('requestId');
    });
  });
});

describe('AllExceptionsFilter: erros do banco (QueryFailedError)', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function erroDoBanco(codigo: string, extra: Record<string, unknown> = {}) {
    const driverError = Object.assign(
      new Error('detalhe interno: INSERT INTO "users" ... (email)=(a@b.com)'),
      {
        code: codigo,
        detail: 'Key (email)=(a@b.com) already exists.',
        ...extra,
      },
    );
    return new QueryFailedError(
      'INSERT INTO "users" ...',
      ['a@b.com'],
      driverError,
    );
  }

  it('23505 em UQ_users_email vira 409 com a mensagem do cadastro duplicado', () => {
    const { status, body } = executar(
      erroDoBanco('23505', { constraint: 'UQ_users_email' }),
    );

    expect(status).toBe(409);
    expect(body['message']).toBe('Este e-mail já está cadastrado.');
    expect(body['error']).toBe('CONFLICT');
  });

  it('23505 em UQ_project_members_project_user vira 409 "Usuário já é membro do projeto."', () => {
    const { status, body } = executar(
      erroDoBanco('23505', { constraint: 'UQ_project_members_project_user' }),
    );

    expect(status).toBe(409);
    expect(body['message']).toBe('Usuário já é membro do projeto.');
  });

  it('23505 em outra constraint vira 409 com a mensagem genérica', () => {
    const { status, body } = executar(
      erroDoBanco('23505', { constraint: 'UQ_qualquer' }),
    );

    expect(status).toBe(409);
    expect(body['message']).toBe('O registro informado já existe.');
  });

  it('23503 (chave estrangeira) vira 409', () => {
    const { status, body } = executar(
      erroDoBanco('23503', { constraint: 'FK_tasks_assignee' }),
    );

    expect(status).toBe(409);
    expect(body['message']).toBe(
      'A operação não pôde ser concluída porque o registro está em uso ou referencia outro inexistente.',
    );
  });

  it('22P02 (formato inválido) vira 400', () => {
    const { status, body } = executar(erroDoBanco('22P02'));

    expect(status).toBe(400);
    expect(body['message']).toBe(
      'Um dos valores informados está em formato inválido.',
    );
    expect(body['error']).toBe('BAD_REQUEST');
  });

  it.each(['23505', '23503', '22P02'])(
    'não vaza SQL, detalhes nem nomes de constraint na resposta (%s)',
    (codigo) => {
      const { body } = executar(
        erroDoBanco(codigo, { constraint: 'UQ_users_email' }),
      );

      const texto = JSON.stringify(body);
      expect(texto).not.toMatch(
        /INSERT|a@b\.com|detalhe interno|Key \(|already exists/,
      );
    },
  );

  it('outros códigos do Postgres seguem como 500 genérico, sem vazar o erro', () => {
    const { status, body } = executar(erroDoBanco('42P01'));

    expect(status).toBe(500);
    expect(body['message']).toBe(INTERNAL_ERROR_MESSAGE);
    expect(JSON.stringify(body)).not.toMatch(/INSERT|a@b\.com/);
  });
});
