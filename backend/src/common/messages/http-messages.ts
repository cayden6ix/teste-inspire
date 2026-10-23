/**
 * Mensagens genericas por status HTTP, usadas quando o erro nao traz uma mensagem de dominio.
 */
export const STATUS_MESSAGES: Record<number, string> = {
  400: 'Requisição inválida.',
  401: 'Você precisa estar autenticado para continuar.',
  403: 'Você não tem permissão para realizar esta ação.',
  404: 'Recurso não encontrado.',
  405: 'Método não permitido para este recurso.',
  408: 'A requisição demorou mais do que o esperado. Tente novamente.',
  409: 'Conflito: o registro já existe.',
  412: 'A requisição não atende às condições exigidas pelo servidor.',
  413: 'O arquivo ou a requisição excede o tamanho permitido.',
  415: 'Tipo de conteúdo não suportado.',
  422: 'Não foi possível processar os dados enviados.',
  429: 'Muitas requisições. Aguarde alguns instantes e tente novamente.',
  500: 'Erro interno do servidor. Tente novamente em instantes.',
  503: 'Serviço temporariamente indisponível. Tente novamente em instantes.',
};

/**
 * Mensagens padrao em ingles (Nest, Express, passport e multer) que sao trocadas pela
 * mensagem generica do status. Textos de dominio em portugues nunca entram aqui.
 */
export const ENGLISH_DEFAULT_MESSAGES = new Set<string>([
  'Bad Request',
  'Bad Request Exception',
  'Unauthorized',
  'Forbidden',
  'Forbidden resource',
  'Not Found',
  'Not Found Exception',
  'Method Not Allowed',
  'Conflict',
  'Payload Too Large',
  'Request Entity Too Large',
  'File too large',
  'Unsupported Media Type',
  'Unprocessable Entity',
  'Too Many Requests',
  'Internal Server Error',
  'Request Timeout',
  'Precondition Failed',
  'Service Unavailable',
]);

/** Limite do upload de CSV (5 MB), conforme `CSV_UPLOAD_LIMITS`. */
export const UPLOAD_TOO_LARGE_MESSAGE = 'O arquivo excede o tamanho máximo permitido de 5 MB.';

/**
 * Mensagens de origem tecnica (multer, body-parser) reescritas para o usuario final.
 * A chave e avaliada como expressao regular contra a mensagem recebida.
 */
export const TECHNICAL_MESSAGE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/^File too large/, UPLOAD_TOO_LARGE_MESSAGE],
  [/^Too many files/, 'Envie apenas um arquivo por requisição.'],
  [
    /^Unexpected (file )?field/,
    'Campo de arquivo inesperado. Envie o arquivo no campo "file".',
  ],
  [/^Multipart: /, 'Não foi possível ler o arquivo enviado. Verifique o formato do envio.'],
  [/^Failed to decode param/, 'Um dos parâmetros da URL está malformado.'],
  [/JSON/, 'Corpo da requisição inválido: o JSON está malformado.'],
];

export const ROUTE_NOT_FOUND_MESSAGE = 'Rota não encontrada.';

export const INVALID_UUID_MESSAGE = 'O identificador informado é inválido.';

export const TOKEN_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente.';

export const TOKEN_INVALID_MESSAGE = 'Token inválido. Faça login novamente.';

export const INTERNAL_ERROR_MESSAGE = STATUS_MESSAGES[500];

/**
 * Erros do Postgres (codigo SQLSTATE) que viram resposta 4xx sem expor detalhes do banco.
 * Cobrem corridas que a checagem previa nao evita (ex.: dois cadastros simultaneos).
 */
export const DATABASE_ERRORS: Record<string, { status: number; message: string }> = {
  // unique_violation
  '23505': { status: 409, message: 'O registro informado já existe.' },
  // foreign_key_violation
  '23503': {
    status: 409,
    message:
      'A operação não pôde ser concluída porque o registro está em uso ou referencia outro inexistente.',
  },
  // invalid_text_representation (ex.: valor que nao e UUID nem enum valido)
  '22P02': { status: 400, message: 'Um dos valores informados está em formato inválido.' },
};

/**
 * Mensagem de dominio por constraint de unicidade, mais clara que a generica do 23505.
 */
export const UNIQUE_CONSTRAINT_MESSAGES: Record<string, string> = {
  UQ_users_email: 'Este e-mail já está cadastrado.',
  UQ_project_members_project_user: 'Usuário já é membro do projeto.',
};
