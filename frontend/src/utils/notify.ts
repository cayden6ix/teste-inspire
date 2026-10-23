import axios from 'axios';
import { errorList, isNetworkError } from '@/utils/errorMessage';
import { toast } from '@/stores/toastStore';

/**
 * Toast de erro de uma acao: `title` diz o que falhou e o detalhe e a mensagem em portugues
 * devolvida pela API (array vira lista curta). Falha de rede usa o mesmo `id` do aviso global
 * do httpClient, entao os dois se fundem em um unico toast.
 */
export function notifyError(error: unknown, title: string) {
  // 401 (sessao expirada) tem aviso proprio no httpClient; requisicao cancelada nao e erro.
  if (axios.isCancel(error) || (axios.isAxiosError(error) && error.response?.status === 401)) {
    return;
  }

  const messages = errorList(error, title);
  const network = isNetworkError(error);
  const detail = messages.length === 1 && messages[0] !== title ? messages[0] : undefined;

  toast.error({
    id: network ? 'network-error' : undefined,
    title,
    description: detail,
    items: messages.length > 1 ? messages : undefined,
  });
}
