import axios from 'axios';

/**
 * Extrai uma mensagem legivel do erro devolvido pela API.
 */
export function errorMessage(
  error: unknown,
  fallback = 'Ocorreu um erro inesperado. Tente novamente.',
): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    if (status === 401) {
      return 'Sessao expirada ou credenciais invalidas. Entre novamente.';
    }

    if (status === 403) {
      return 'Voce nao tem permissao para esta acao.';
    }

    const data = error.response?.data as { message?: string | string[] } | undefined;
    const message = data?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }

  return fallback;
}
