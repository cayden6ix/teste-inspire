/** Rotas de quem nao esta logado: nunca sao destino de "voltar para" depois de entrar. */
const GUEST_ROUTES = ['/login', '/register'];

/** Caminho interno da aplicacao (`/projects/1`), nunca `//outro-site` nem URL absoluta. */
function isInternalPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

/**
 * Para onde ir depois de entrar (ou de cadastrar).
 *
 * - `from` (a rota que pediu login) so vale se for um caminho interno que nao seja login/cadastro;
 * - se a sessao anterior EXPIROU (`expiredUserId`), so o MESMO usuario volta para `from`: outra
 *   pessoa entrando no mesmo navegador cai na home, sem herdar a rota de quem saiu;
 * - sem `from` (cadastro, ou depois de clicar em Sair), o destino e a home.
 */
export function postLoginPath(
  from: unknown,
  expiredUserId: string | null,
  userId: string | null,
): string {
  if (!isInternalPath(from) || GUEST_ROUTES.some((route) => from === route || from.startsWith(`${route}?`))) {
    return '/';
  }

  if (expiredUserId !== null && expiredUserId !== userId) {
    return '/';
  }

  return from;
}
