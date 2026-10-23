import axios from 'axios';

export const NETWORK_ERROR_MESSAGE = 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
export const TIMEOUT_ERROR_MESSAGE = 'O servidor demorou para responder. Tente novamente.';
/** Único texto de 401 quando a API não mandou `message` (a API já devolve o texto em PT-BR). */
export const SESSION_EXPIRED_MESSAGE = 'Sua sessão expirou. Faça login novamente.';

const FORBIDDEN_MESSAGE = 'Você não tem permissão para realizar esta ação.';
const RATE_LIMIT_MESSAGE = 'Muitas requisições. Aguarde alguns instantes e tente novamente.';
const SERVER_ERROR_MESSAGE = 'O servidor encontrou um problema. Tente novamente em instantes.';

/** Erro sem resposta HTTP: rede fora do ar, servidor inacessivel ou tempo esgotado. */
export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && error.code !== 'ERR_CANCELED';
}

type ErrorListOptions = {
  /**
   * Requisição feita sem sessão (login e cadastro): 401 e 403 sem `message` da API não significam
   * "sessão expirada"; usa o texto do chamador.
   */
  anonymous?: boolean;
};

/** Segundos do header Retry-After (só a forma numérica), ou null. */
function retryAfterSeconds(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;

  const value = Number(error.response?.headers?.['retry-after']);

  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : null;
}

/**
 * FONTE ÚNICA das mensagens de erro (formulários, toasts e hooks).
 * A `message` da API (string de domínio ou lista de validação) sempre vence, inclusive em
 * 401/403/409/429; só sem ela entram os textos genéricos. Em 429 acrescenta o Retry-After.
 */
export function errorList(error: unknown, fallback: string, options: ErrorListOptions = {}): string[] {
  if (isNetworkError(error)) {
    return [axios.isAxiosError(error) && error.code === 'ECONNABORTED' ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE];
  }

  if (!axios.isAxiosError(error)) {
    return [fallback];
  }

  const status = error.response?.status;
  const message = (error.response?.data as { message?: string | string[] } | undefined)?.message;
  let items: string[] = [];

  if (Array.isArray(message)) {
    items = message.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } else if (typeof message === 'string' && message.length > 0) {
    items = [message];
  }

  if (status === 429) {
    const seconds = retryAfterSeconds(error);
    const retry = seconds === null ? '' : ` Tente novamente em ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}.`;

    return [`${items.join(' ') || RATE_LIMIT_MESSAGE}${retry}`];
  }

  if (items.length > 0) {
    return items;
  }

  if (options.anonymous && (status === 401 || status === 403)) {
    return [fallback];
  }

  if (status === 401) return [SESSION_EXPIRED_MESSAGE];
  if (status === 403) return [FORBIDDEN_MESSAGE];
  if (status !== undefined && status >= 500) return [SERVER_ERROR_MESSAGE];

  return [fallback];
}

/** Mensagem única (lista de validação unida por espaço). */
export function errorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
  options: ErrorListOptions = {},
): string {
  return errorList(error, fallback, options).join(' ');
}
