import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import {
  errorList,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  TIMEOUT_ERROR_MESSAGE,
} from '@/utils/errorMessage';
import { requestFinished, requestStarted } from './activity';

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

/**
 * Cliente HTTP unico da aplicacao.
 *
 * Em desenvolvimento o Vite faz proxy de /api para o backend (vite.config.ts);
 * em producao o nginx do container faz o mesmo proxy. A base URL e a mesma nos
 * dois ambientes, entao o codigo da aplicacao nao conhece a origem da API.
 */
export const httpClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

/** Requisicoes em andamento: todas sao abortadas quando a sessao expira (401). */
const inflight = new Set<AbortController>();

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    __controller?: AbortController;
  }
}

/**
 * Quem navega (o App registra no mount) quando a sessao expira. A camada HTTP nao conhece o
 * roteador: so avisa. `from` e a rota de origem, para voltar a ela depois de entrar.
 */
type SessionExpiredHandler = (from: string) => void;

let sessionExpiredHandler: SessionExpiredHandler | null = null;

export function registerSessionExpiredHandler(handler: SessionExpiredHandler): () => void {
  sessionExpiredHandler = handler;

  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

/** Login e cadastro respondem 401 para credenciais invalidas: nao sao "sessao expirada". */
const AUTH_ROUTES = ['/auth/login', '/auth/register'];

function release(config: { __controller?: AbortController } | undefined) {
  if (config?.__controller) {
    inflight.delete(config.__controller);
  }
}

/**
 * 401 numa requisicao autenticada = sessao expirada ou token invalido: limpa o authStore (e o
 * token persistido), cancela o que estiver em andamento, avisa UMA vez (toast com `id` fixo) e
 * leva para /login (replace) guardando a rota de origem para voltar depois de entrar.
 * So age se o token usado pela requisicao ainda e o token atual (evita loop e 401 de resposta tardia).
 */
function handleSessionExpired(error: unknown) {
  if (!axios.isAxiosError(error) || error.response?.status !== 401) return;

  const sentAuth = error.config?.headers?.Authorization;
  const current = useAuthStore.getState().accessToken;
  const url = error.config?.url ?? '';

  if (!sentAuth || !current || sentAuth !== `Bearer ${current}` || AUTH_ROUTES.some((route) => url.endsWith(route))) {
    return;
  }

  useAuthStore.getState().logout();
  inflight.forEach((controller) => controller.abort());
  inflight.clear();

  toast.warning({
    id: 'session-expired',
    title: errorList(error, SESSION_EXPIRED_MESSAGE)[0] ?? SESSION_EXPIRED_MESSAGE,
  });

  sessionExpiredHandler?.(`${window.location.pathname}${window.location.search}`);
}

/**
 * A API e stateless: o token JWT e a unica credencial (D-005).
 * Todo endpoint de projetos, tarefas, membros e relatorios exige o header
 * `Authorization: Bearer <access_token>`.
 */
httpClient.interceptors.request.use((config) => {
  // Cada requisicao despachada conta como "em andamento" ate a resposta (sucesso ou erro).
  requestStarted();

  const controller = new AbortController();
  config.__controller = controller;
  config.signal ??= controller.signal;
  inflight.add(controller);

  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Conclui o contador da barra de atividade e avisa falhas de rede com um toast unico
 * (mesmo `id`, entao varias requisicoes falhando juntas nao empilham avisos).
 */
httpClient.interceptors.response.use(
  (response) => {
    requestFinished();
    release(response.config);
    return response;
  },
  (error: unknown) => {
    requestFinished();
    release(axios.isAxiosError(error) ? error.config : undefined);
    handleSessionExpired(error);

    if (isNetworkError(error)) {
      const timedOut = axios.isAxiosError(error) && error.code === 'ECONNABORTED';
      toast.error({
        id: 'network-error',
        title: timedOut ? TIMEOUT_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE,
      });
    }

    return Promise.reject(error);
  },
);
