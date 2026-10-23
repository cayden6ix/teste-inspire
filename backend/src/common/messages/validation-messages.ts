/**
 * Rotulos amigaveis dos campos, usados nas mensagens de validacao.
 *
 * Propriedade sem rotulo aparece com o proprio nome (ex.: campo desconhecido na whitelist).
 */
export const FIELD_LABELS: Record<string, string> = {
  email: 'E-mail',
  password: 'Senha',
  name: 'Nome',
  title: 'Título',
  description: 'Descrição',
  status: 'Status',
  assigneeId: 'Responsável',
  dueDate: 'Data limite',
  dueFrom: 'Data limite inicial',
  dueTo: 'Data limite final',
  role: 'Papel',
  userId: 'Usuário',
  page: 'Página',
  limit: 'Limite',
  search: 'Busca',
  sortBy: 'Ordenar por',
  order: 'Ordem',
  groupBy: 'Agrupar por',
  projectId: 'Projeto',
  file: 'Arquivo',
};

/**
 * Trecho que descreve a regra violada, por constraint do class-validator.
 *
 * `{n}` e `{values}` sao preenchidos a partir da mensagem padrao (ver `buildFieldMessage`).
 * `{format}` vem do contexto da regra (ex.: `@IsDateOnly()` informa AAAA-MM-DD); sem
 * contexto, vale o texto generico `FALLBACK_CONSTRAINT_TEMPLATE`.
 */
export const CONSTRAINT_TEMPLATES: Record<string, string> = {
  isEmail: 'deve ser um e-mail válido',
  isNotEmpty: 'não pode estar vazio',
  isString: 'deve ser um texto',
  isInt: 'deve ser um número inteiro',
  isBoolean: 'deve ser verdadeiro ou falso',
  isArray: 'deve ser uma lista',
  isUuid: 'deve ser um identificador válido (UUID)',
  isEnum: 'deve ser um dos valores: {values}',
  isIn: 'deve ser um dos valores: {values}',
  isDateString: 'deve ser uma data válida no formato AAAA-MM-DD',
  isCalendarDate: 'deve ser uma data válida no formato AAAA-MM-DD',
  matches: 'deve estar no formato {format}',
  min: 'deve ser maior ou igual a {n}',
  max: 'deve ser menor ou igual a {n}',
  minLength: 'deve ter no mínimo {n} caracteres',
  maxLength: 'deve ter no máximo {n} caracteres',
  whitelistValidation: 'não é permitido',
};

/**
 * Usado quando o class-validator dispara uma constraint sem template cadastrado.
 */
export const FALLBACK_CONSTRAINT_TEMPLATE = 'é inválido';
