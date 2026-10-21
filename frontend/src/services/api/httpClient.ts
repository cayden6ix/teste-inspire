import axios from 'axios';

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
